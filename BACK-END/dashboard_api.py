from fastapi import FastAPI
from pydantic import BaseModel
import json
import re
import requests

from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential
from azure.ai.agents.models import ListSortOrder
from fastapi.middleware.cors import CORSMiddleware

PROJECT_ENDPOINT = "https://6eopenai-aifoundry-np-ea.services.ai.azure.com/api/projects/6eopenai-aifoundry-np-e-project"
AGENT_ID = "asst_vDuMomx3g6JlA2og2s6LQrgq"
MCP_URL = "http://127.0.0.1:80001/mcp"

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class DashboardQuery(BaseModel):
    question: str


def extract_json_from_response(raw_text: str) -> dict:
    """Extract JSON from agent response"""
    if not raw_text or not raw_text.strip():
        raise ValueError("Agent returned empty response")

    text = raw_text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    code_block_pattern = r'```(?:json)?\s*([\s\S]*?)```'
    matches = re.findall(code_block_pattern, text)
    for match in matches:
        try:
            return json.loads(match.strip())
        except json.JSONDecodeError:
            continue

    json_pattern = r'\{[\s\S]*\}'
    json_matches = re.findall(json_pattern, text)
    for match in json_matches:
        try:
            return json.loads(match)
        except json.JSONDecodeError:
            continue

    raise ValueError(f"Could not extract valid JSON")


def clean_payload(payload: dict) -> dict:
    """Remove invalid filter values like '...' """
    if "arguments" in payload:
        if "filters" in payload["arguments"]:
            filters = payload["arguments"]["filters"]
            cleaned_filters = {
                k: v for k, v in filters.items() 
                if v and v != "..." and v != ""
            }
            payload["arguments"]["filters"] = cleaned_filters
            
            if not cleaned_filters:
                del payload["arguments"]["filters"]
    
    return payload


@app.post("/dashboard/query")
def dashboard_query(payload: DashboardQuery):
    """
    Dashboard API endpoint.
    Passes user query to agent → Extracts payload → Routes to MCP → Returns to UI
    Agent handles all parameter extraction using its configured instructions.
    """
    try:
        # Call Agent with just the user's question
        client = AIProjectClient(
            endpoint=PROJECT_ENDPOINT,
            credential=DefaultAzureCredential()
        )

        with client:
            thread = client.agents.threads.create()

            # Just send the question - agent has its own instructions configured
            client.agents.messages.create(
                thread_id=thread.id,
                role="user",
                content=payload.question
            )

            run = client.agents.runs.create_and_process(
                thread_id=thread.id,
                agent_id=AGENT_ID
            )

            if hasattr(run, 'status') and run.status == "failed":
                return {"error": "Agent processing failed", "status": "failed"}

            messages = client.agents.messages.list(
                thread_id=thread.id,
                order=ListSortOrder.ASCENDING
            )

            agent_response = None
            for m in reversed(list(messages)):
                if m.role == "assistant" and m.text_messages:
                    agent_response = m.text_messages[0].text.value
                    break

        if not agent_response:
            return {"error": "No agent response"}

        # Extract and clean the JSON payload from agent
        try:
            params_payload = extract_json_from_response(agent_response)
            params_payload = clean_payload(params_payload)
        except Exception as e:
            return {"error": f"Failed to parse agent response: {str(e)}", "raw": agent_response}

        # Extract tool name and arguments
        tool_name = params_payload.get("tool")
        arguments = params_payload.get("arguments", {})

        if not tool_name:
            return {"error": "No tool specified in agent response", "payload": params_payload}

        # Clean up arguments
        if tool_name == "uniform_entitlement_kpi":
            arguments.pop("group_by", None)
            if "time_range" in arguments and not arguments["time_range"]:
                arguments.pop("time_range")

        # Call MCP with extracted parameters
        mcp_payload = {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments
            },
            "id": 1
        }

        response = requests.post(
            MCP_URL,
            json=mcp_payload,
            headers={
                "Accept": "application/json, text/event-stream",
                "Content-Type": "application/json"
            },
            timeout=60
        )

        if response.status_code != 200:
            return {"error": f"MCP call failed: {response.status_code}", "text": response.text}

        # Parse and return MCP response
        for line in response.text.splitlines():
            if line.startswith("data:"):
                try:
                    data = json.loads(line.replace("data:", "").strip())
                    result = data.get("result", {})
                    
                    structured = result.get("structuredContent", {})
                    content = structured.get("content", [])
                    
                    if content and len(content) > 0:
                        for item in content:
                            if item.get("type") == "json":
                                return item["json"]
                    
                    for item in result.get("content", []):
                        if item.get("type") == "text":
                            try:
                                parsed = json.loads(item["text"])
                                for c in parsed.get("content", []):
                                    if c.get("type") == "json":
                                        return c["json"]
                            except:
                                pass
                except Exception as e:
                    continue

        return {"error": "No valid MCP response found"}

    except Exception as e:
        return {"error": str(e), "type": type(e).__name__}


@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "Dashboard API"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=9000)