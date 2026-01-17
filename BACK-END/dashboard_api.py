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
            prompt = f"""
You are a PARAMETER-EXTRACTION AGENT for a uniform management system.

CRITICAL RULES:
1. Return ONLY valid JSON (no markdown, no explanation)
2. ONLY include filters that are EXPLICITLY mentioned in the query
3. NEVER add placeholder values like "..."
4. If a parameter is not mentioned, OMIT it completely

--------------------------------------------------
AVAILABLE TOOLS
--------------------------------------------------

1. employee_kpi - Employee queries (active, inactive, eligible, ineligible)
2. uniform_entitlement_kpi - Uniform/SKU queries (counts, demand)

--------------------------------------------------
TOOL SELECTION RULES
--------------------------------------------------

Use "employee_kpi" for:
- Total employees, active employees, inactive employees
- Employee counts, headcount
- Employee status (active/inactive breakdown)
- Employee eligibility (eligible/ineligible employees or departments)
- Eligible departments, which departments are eligible
- Employee trends by joining month

Use "uniform_entitlement_kpi" for:
- SKU counts, unique SKUs, number of SKUs
- Uniform items, item names
- SKUs by department/gender/location/frequency
- SKU demand (quantity needed over time)
- Common SKUs vs department-specific SKUs
- Specific month demands

--------------------------------------------------
METRIC SELECTION FOR EMPLOYEE KPI
--------------------------------------------------

"total employees" / "employee count" / "headcount"
→ metric = "total"

"active employees" / "how many active"
→ metric = "active"

"inactive employees" / "how many inactive"
→ metric = "inactive"

"active vs inactive" / "status breakdown" / "employee status" / "department summary"
→ metric = "status"

"summary of departments"
→ metric = "status"

"eligible employees" / "how many eligible"
→ metric = "eligible_employees"

"ineligible employees"
→ metric = "ineligible_employees"

"total departments" / "how many departments" (ONLY for ALL departments, NOT eligible ones)
→ metric = "total_departments"

"eligible departments" / "which departments are eligible" / "total number of eligible departments"
→ metric = "eligible_departments"

"department eligibility" / "eligibility by department" / "eligible employees breakdown by department" / "eligible employees by department"
→ metric = "department_eligibility"

"eligibility by gender"
→ metric = "eligibility_by_gender"

"eligibility trend" / "eligible employees over time" / "eligible employees breakdown by month" / "eligible employees by issuance month"
→ metric = "eligibility_trend"

"headcount vs eligibility"
→ metric = "headcount_vs_eligibility"

--------------------------------------------------
METRIC SELECTION FOR UNIFORM ENTITLEMENT
--------------------------------------------------

**SKU COUNT QUERIES:**

"total SKUs" / "count of SKUs" / "how many SKUs" / "number of SKUs"
→ metric = "unique_skus"

"total SKUs for [department]" / "SKUs by department" / "department-wise SKUs" / "total unique SKUs breakdown by department"
→ metric = "skus_by_department"

"SKUs by gender" / "gender-wise SKUs" / "male vs female SKUs"
→ metric = "skus_by_gender"

"SKUs by location" / "location-wise SKUs" / "SKUs per location"
→ metric = "skus_by_location"

"SKUs by frequency" / "frequency-wise SKUs" / "how often items issued"
→ metric = "skus_by_frequency"

"entitlement coverage matrix"
→ metric = "entitlement_coverage_matrix"

**DEMAND QUERIES:**

"SKU demand" / "quantity needed" / "items required" / "how many [item] needed"
→ metric = "sku_demand" (MUST include time_range OR months)

**SPECIAL METRICS:**

"eligible departments for uniforms"
→ metric = "eligible_departments" (from employee_kpi)

"employees with demand" / "how many will receive items"
→ metric = "employees_with_demand"

"total employees in department"
→ metric = "total_employees"

**ENTITLEMENT DETAILS:**

"all uniform entitlement details" / "entitlement details" / "list all entitlements"
→ metric = "all_uniform_entitlements"

--------------------------------------------------
CRITICAL: DEMAND vs COUNT DISTINCTION
--------------------------------------------------

DEMAND queries (use sku_demand):
- "quantity needed"
- "items required"
- "how many [item] needed"
- "demand for [item]"
- "T-shirt demand"
→ These calculate total quantity over time

COUNT queries (use unique_skus or skus_by_*):
- "total SKUs"
- "count of SKUs"
- "number of different SKUs"
- "how many types of items"
→ These count unique item types

--------------------------------------------------
DEPARTMENT NORMALIZATION
--------------------------------------------------

"AOCS" / "Airport Ops" → "Airport Operations & Customer Services"
"Inflight" / "IFS" / "Cabin crew" → "Inflight Services"
"Engineering" / "Tech" → "Engineering"
"Flight Ops" / "Pilots" → "Flight Operations"
"OCC" → "Operation Control Center"
"Cargo" → "Cargo"

--------------------------------------------------
FILTER RULES (CRITICAL)
--------------------------------------------------

1. ONLY include filters EXPLICITLY mentioned in the query
2. If department is NOT mentioned, DO NOT add department filter
3. If location is NOT mentioned, DO NOT add location filter
4. If gender is NOT mentioned, DO NOT add gender filter
5. If status is NOT mentioned, DO NOT add status filter (it defaults to 'active' in the tool)
6. ALWAYS include a filter if explicitly mentioned, EVEN IF you are grouping by the same field (e.g., breakdown by gender and gender Male).
7. NEVER use placeholder values like "..."

Examples:
✅ "total active employees" → {{"metric": "active", "filters": {{}}}}
✅ "active employees in AOCS" → {{"metric": "active", "filters": {{"department": "Airport Operations & Customer Services"}}}}
✅ "ineligible employees with status active" → {{"metric": "ineligible_employees", "filters": {{"status": "active"}}}}
✅ "active employees in Delhi" → {{"metric": "active", "filters": {{"location": "Delhi"}}}}
❌ "total active employees" → DO NOT add {{"location": "..."}}

--------------------------------------------------
TIME RANGE RULES (CRITICAL FOR DEMAND)
--------------------------------------------------

**Context:**
- Last uniform issue: Aug 31, 2025
- Any query after this date = FUTURE DEMAND
- Employee joining dates: Dec 2005 - Aug 2025

**For sku_demand metric:**

OPTION 1 - Date Range (from/to):
- Use when query mentions "from X to Y" or "between X and Y"
- Format: {{"from": "YYYY-MM", "to": "YYYY-MM"}}
- Example: "demand from Jan 2026 to Dec 2026"
  → {{"time_range": {{"from": "2026-01", "to": "2026-12"}}}}

OPTION 2 - Specific Months:
- Use when query mentions specific months
- Add to filters: "months": ["YYYY-MM", "YYYY-MM"]
- Example: "demand for Sep 2025, Dec 2025, and March 2026"
  → {{"filters": {{"months": ["2025-09", "2025-12", "2026-03"]}}}}

OPTION 3 - No time specified:
- Default: {{"from": "2025-09", "to": "2026-09"}} (next 12 months)

**For other metrics:**
- OMIT time_range unless specifically mentioned

--------------------------------------------------
GROUP_BY RULES (EMPLOYEE KPI ONLY)
--------------------------------------------------

"by department" / "department-wise" / "per department" / "department summary"
→ group_by = "department"

"by gender" / "gender-wise" / "male vs female"
→ group_by = "gender"

"by location" / "location-wise" / "per location"
→ group_by = "location"

"summary" / "status breakdown" / "active vs inactive" (for individual counts)
→ group_by = "status"

If NOT mentioned → OMIT group_by

--------------------------------------------------
EXAMPLES
--------------------------------------------------

**EMPLOYEE KPI EXAMPLES:**

Query: "total inactive employees"
{{
  "tool": "employee_kpi",
  "arguments": {{
    "metric": "inactive"
  }}
}}

Query: "inactive employees in AOCS"
{{
  "tool": "employee_kpi",
  "arguments": {{
    "metric": "inactive",
    "filters": {{
      "department": "Airport Operations & Customer Services"
    }}
  }}
}}

Query: "active vs inactive employees by department"
{{
  "tool": "employee_kpi",
  "arguments": {{
    "metric": "status",
    "group_by": "department"
  }}
}}

Query: "eligible employees"
{{
  "tool": "employee_kpi",
  "arguments": {{
    "metric": "eligible_employees"
  }}
}}

Query: "which departments are eligible"
{{
  "tool": "employee_kpi",
  "arguments": {{
    "metric": "department_eligibility"
  }}
}}

Query: "eligible employees breakdown by gender"
{{
  "tool": "employee_kpi",
  "arguments": {{
    "metric": "eligible_employees",
    "group_by": "gender"
  }}
}}

Query: "department summary"
{{
  "tool": "employee_kpi",
  "arguments": {{
    "metric": "status",
    "group_by": "department"
  }}
}}

Query: "total number of eligible departments"
{{
  "tool": "employee_kpi",
  "arguments": {{
    "metric": "eligible_departments"
  }}
}}

Query: "eligible employees breakdown by issuance month in Cargo department in Bengaluru with status Inactive"
{{
  "tool": "employee_kpi",
  "arguments": {{
    "metric": "eligibility_trend",
    "filters": {{
      "department": "Cargo",
      "location": "Bengaluru",
      "status": "Inactive"
    }}
  }}
}}

Query: "active employees breakdown by gender"
{{
  "tool": "employee_kpi",
  "arguments": {{
    "metric": "active",
    "group_by": "gender"
  }}
}}

Query: "eligible employees breakdown by gender"
{{
  "tool": "employee_kpi",
  "arguments": {{
    "metric": "eligible_employees",
    "group_by": "gender"
  }}
}}

Query: "eligible employee summary in Cargo department in Delhi and gender Female"
{{
  "tool": "employee_kpi",
  "arguments": {{
    "metric": "eligible_employees",
    "group_by": "status",
    "filters": {{
      "department": "Cargo",
      "location": "Delhi",
      "gender": "Female"
    }}
  }}
}}

Query: "eligible employees breakdown by department"
{{
  "tool": "employee_kpi",
  "arguments": {{
    "metric": "department_eligibility"
  }}
}}

Query: "active employees breakdown by gender in Cargo department in Bengaluru with status Inactive and gender Male"
{{
  "tool": "employee_kpi",
  "arguments": {{
    "metric": "active",
    "group_by": "gender",
    "filters": {{
      "department": "Cargo",
      "location": "Bengaluru",
      "status": "Inactive",
      "gender": "Male"
    }}
  }}
}}

**UNIFORM ENTITLEMENT EXAMPLES:**

Query: "entitlement coverage matrix"
{{
  "tool": "uniform_entitlement_kpi",
  "arguments": {{
    "metric": "entitlement_coverage_matrix"
  }}
}}

Query: "total SKUs"
{{
  "tool": "uniform_entitlement_kpi",
  "arguments": {{
    "metric": "unique_skus"
  }}
}}

Query: "total SKUs for AOCS"
{{
  "tool": "uniform_entitlement_kpi",
  "arguments": {{
    "metric": "skus_by_department",
    "filters": {{
      "department": "Airport Operations & Customer Services"
    }}
  }}
}}

Query: "SKUs by gender"
{{
  "tool": "uniform_entitlement_kpi",
  "arguments": {{
    "metric": "skus_by_gender"
  }}
}}

Query: "SKUs by frequency"
{{
  "tool": "uniform_entitlement_kpi",
  "arguments": {{
    "metric": "skus_by_frequency"
  }}
}}

Query: "T-shirt demand for Engineering from Jan 2026 to Dec 2026"
{{
  "tool": "uniform_entitlement_kpi",
  "arguments": {{
    "metric": "sku_demand",
    "filters": {{
      "department": "Engineering",
      "sku": "T-shirts"
    }},
    "time_range": {{
      "from": "2026-01",
      "to": "2026-12"
    }}
  }}
}}

Query: "demand for September 2025 and December 2025"
{{
  "tool": "uniform_entitlement_kpi",
  "arguments": {{
    "metric": "sku_demand",
    "filters": {{
      "months": ["2025-09", "2025-12"]
    }}
  }}
}}

Query: "SKU demand for AOCS"
{{
  "tool": "uniform_entitlement_kpi",
  "arguments": {{
    "metric": "sku_demand",
    "filters": {{
      "department": "Airport Operations & Customer Services"
    }},
    "time_range": {{
      "from": "2025-09",
      "to": "2026-09"
Query: "how many unique SKUs in Inflight Services"
{{
  "tool": "uniform_entitlement_kpi",
  "arguments": {{
    "metric": "unique_skus",
    "filters": {{
      "department": "Inflight Services"
    }}
  }}
}}

Query: "all uniform entitlement details"
{{
  "tool": "uniform_entitlement_kpi",
  "arguments": {{
    "metric": "all_uniform_entitlements"
  }}
}}

--------------------------------------------------
USER QUESTION
--------------------------------------------------

"{payload.question}"

RESPOND WITH ONLY THE JSON OBJECT:
"""
            # Create a new thread for this conversation
            thread = client.agents.threads.create()

            # Send ONLY the user's question - agent has its own system instructions
            client.agents.messages.create(
                thread_id=thread.id,
                role="user",
                content=prompt
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