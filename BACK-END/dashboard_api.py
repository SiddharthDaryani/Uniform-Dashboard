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
MCP_URL = "http://127.0.0.1:8000/mcp"  # Fixed port to match your MCP server

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

    raise ValueError(f"Could not extract valid JSON from response:\n{text[:500]}")


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
    Sends user question to Azure AI Agent → Agent extracts parameters → Routes to MCP → Returns data to UI
    
    The agent is pre-configured with instructions in Azure AI Studio, so we only send the user's question.
    """
    try:
        # Initialize Azure AI client
        client = AIProjectClient(
            endpoint=PROJECT_ENDPOINT,
            credential=DefaultAzureCredential()
        )

        with client:
            # Create a new thread for this conversation
            thread = client.agents.threads.create()

            # Send ONLY the user's question - agent has its own system instructions
            client.agents.messages.create(
                thread_id=thread.id,
                role="user",
                content=payload.question
            )

            # Run the agent
            run = client.agents.runs.create_and_process(
                thread_id=thread.id,
                agent_id=AGENT_ID
            )

            # Check for failures
            if hasattr(run, 'status') and run.status == "failed":
                error_msg = getattr(run, 'last_error', 'Unknown error')
                return {
                    "error": "Agent processing failed",
                    "status": "failed",
                    "details": str(error_msg)
                }

            # Retrieve agent's response
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
            return {"error": "No response from agent"}

        # Extract JSON payload from agent's response
        try:
            params_payload = extract_json_from_response(agent_response)
            params_payload = clean_payload(params_payload)
        except Exception as e:
            return {
                "error": f"Failed to parse agent response: {str(e)}",
                "raw_response": agent_response[:500]
            }

        # Get tool name and arguments
        tool_name = params_payload.get("tool")
        arguments = params_payload.get("arguments", {})

        if not tool_name:
            return {
                "error": "No tool specified in agent response",
                "payload": params_payload
            }

        # Clean up arguments based on tool type
        if tool_name == "uniform_entitlement_kpi":
            # Remove group_by - not supported for uniform entitlement
            arguments.pop("group_by", None)
            
            # Remove empty time_range
            if "time_range" in arguments and not arguments["time_range"]:
                arguments.pop("time_range")

        # Prepare MCP request
        mcp_request = {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments
            },
            "id": 1
        }

        # Call MCP server
        mcp_response = requests.post(
            MCP_URL,
            json=mcp_request,
            headers={
                "Accept": "application/json, text/event-stream",
                "Content-Type": "application/json"
            },
            timeout=400
        )

        if mcp_response.status_code != 200:
            return {
                "error": f"MCP call failed with status {mcp_response.status_code}",
                "details": mcp_response.text[:500]
            }

        # Parse MCP response (handles streaming format)
        for line in mcp_response.text.splitlines():
            if not line.startswith("data:"):
                continue

            try:
                raw_data = line.replace("data:", "", 1).strip()
                envelope = json.loads(raw_data)
                result = envelope.get("result", {})

                # CASE 1: structuredContent
                structured = result.get("structuredContent", {})
                structured_content = structured.get("content", [])

                for item in structured_content:
                    if item.get("type") == "json":
                        return item["json"]

                # CASE 2: content → text → embedded JSON
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

        return {
            "error": "No valid JSON response found from MCP",
            "raw_response": mcp_response.text[:500]
        }

    except Exception as e:
        return {
            "error": str(e),
            "error_type": type(e).__name__
        }


@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "Dashboard API",
        "agent_id": AGENT_ID,
        "mcp_url": MCP_URL
    }


@app.get("/")
def root():
    """Root endpoint with API information"""
    return {
        "service": "Uniform Management Dashboard API",
        "version": "1.0.0",
        "endpoints": {
            "query": "POST /dashboard/query",
            "health": "GET /health"
        },
        "usage": {
            "method": "POST",
            "endpoint": "/dashboard/query",
            "body": {
                "question": "your question here"
            },
            "example": {
                "question": "total SKUs for AOCS"
            }
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=9000)