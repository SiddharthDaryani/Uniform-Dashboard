import json
import re
import requests
import sys
from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential
from azure.ai.agents.models import ListSortOrder


# =========================================================
# CONFIGURATION
# =========================================================
PROJECT_ENDPOINT = "https://6eopenai-aifoundry-np-ea.services.ai.azure.com/api/projects/6eopenai-aifoundry-np-e-project"
AGENT_ID = "asst_vDuMomx3g6JlA2og2s6LQrgq"
MCP_URL = "http://127.0.0.1:8000/mcp"

# Debug mode - set to False for clean JSON output only
DEBUG_MODE = False


# =========================================================
# ROBUST JSON EXTRACTION
# =========================================================
def extract_json_from_response(raw_text: str) -> dict:
    """Extract JSON from agent response"""
    if not raw_text or not raw_text.strip():
        raise ValueError("Agent returned empty response")

    text = raw_text.strip()

    # Try direct JSON parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Extract from markdown code block
    code_block_pattern = r'```(?:json)?\s*([\s\S]*?)```'
    matches = re.findall(code_block_pattern, text)

    for match in matches:
        try:
            return json.loads(match.strip())
        except json.JSONDecodeError:
            continue

    # Find JSON object anywhere in text
    json_pattern = r'\{[\s\S]*\}'
    json_matches = re.findall(json_pattern, text)

    for match in json_matches:
        try:
            return json.loads(match)
        except json.JSONDecodeError:
            continue

    raise ValueError(f"Could not extract valid JSON from response:\n{text[:500]}")


# =========================================================
# CLEAN PAYLOAD - Remove invalid filter values
# =========================================================
def clean_payload(payload: dict) -> dict:
    """Remove invalid filter values like '...' """
    if "arguments" in payload:
        if "filters" in payload["arguments"]:
            filters = payload["arguments"]["filters"]
            # Remove any filter with value "..."
            cleaned_filters = {
                k: v for k, v in filters.items() 
                if v and v != "..." and v != ""
            }
            payload["arguments"]["filters"] = cleaned_filters
            
            # If filters is now empty, remove it
            if not cleaned_filters:
                del payload["arguments"]["filters"]
    
    return payload


# =========================================================
# MAIN AGENT RUNNER
# =========================================================
def run_agent(user_query: str):
    client = AIProjectClient(
        endpoint=PROJECT_ENDPOINT,
        credential=DefaultAzureCredential()
    )

    with client:
        thread = client.agents.threads.create()

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

"active vs inactive" / "status breakdown" / "employee status"
→ metric = "status"

"eligible employees" / "how many eligible"
→ metric = "eligible_employees"

"ineligible employees"
→ metric = "ineligible_employees"

"eligible departments" / "which departments are eligible" / "how many departments"
→ metric = "eligible_departments"

"department eligibility" / "eligibility by department"
→ metric = "department_eligibility"

"eligibility by gender"
→ metric = "eligibility_by_gender"

"eligibility trend" / "eligible employees over time"
→ metric = "eligibility_trend"

"headcount vs eligibility"
→ metric = "headcount_vs_eligibility"

--------------------------------------------------
METRIC SELECTION FOR UNIFORM ENTITLEMENT
--------------------------------------------------

**SKU COUNT QUERIES:**

"total SKUs" / "count of SKUs" / "how many SKUs" / "number of SKUs"
→ metric = "unique_skus"

"total SKUs for [department]" / "SKUs by department" / "department-wise SKUs"
→ metric = "skus_by_department"

"SKUs by gender" / "gender-wise SKUs" / "male vs female SKUs"
→ metric = "skus_by_gender"

"SKUs by location" / "location-wise SKUs" / "SKUs per location"
→ metric = "skus_by_location"

"SKUs by frequency" / "frequency-wise SKUs" / "how often items issued"
→ metric = "skus_by_frequency"

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
5. NEVER use placeholder values like "..."

Examples:
✅ "total active employees" → {{"metric": "active", "filters": {{}}}}
✅ "active employees in AOCS" → {{"metric": "active", "filters": {{"department": "Airport Operations & Customer Services"}}}}
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

"by department" / "department-wise" / "per department"
→ group_by = "department"

"by gender" / "gender-wise" / "male vs female"
→ group_by = "gender"

"by location" / "location-wise" / "per location"
→ group_by = "location"

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

**UNIFORM ENTITLEMENT EXAMPLES:**

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
    }}
  }}
}}

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

--------------------------------------------------
USER QUESTION
--------------------------------------------------

"{user_query}"

RESPOND WITH ONLY THE JSON OBJECT:
"""

        client.agents.messages.create(
            thread_id=thread.id,
            role="user",
            content=prompt
        )

        run = client.agents.runs.create_and_process(
            thread_id=thread.id,
            agent_id=AGENT_ID
        )

        if hasattr(run, 'status') and run.status == "failed":
            error_msg = getattr(run, 'last_error', 'Unknown error')
            raise RuntimeError(f"Agent run failed: {error_msg}")

        messages = client.agents.messages.list(
            thread_id=thread.id,
            order=ListSortOrder.ASCENDING
        )

        for m in reversed(list(messages)):
            if m.role == "assistant" and m.text_messages:
                raw_response = m.text_messages[0].text.value

                if DEBUG_MODE:
                    print(f"[DEBUG] Raw agent response:")
                    print("-" * 50)
                    print(raw_response)
                    print("-" * 50)

                try:
                    payload = extract_json_from_response(raw_response)
                    payload = clean_payload(payload)
                    
                    if DEBUG_MODE:
                        print(f"[DEBUG] Cleaned payload: {json.dumps(payload, indent=2)}")
                    
                    return call_mcp(payload)
                except ValueError as e:
                    if DEBUG_MODE:
                        print(f"[ERROR] JSON extraction failed: {e}")
                    raise

    raise RuntimeError("No agent response found in thread")


# =========================================================
# MCP CALL HANDLER
# =========================================================
def call_mcp(payload: dict):
    tool_name = payload.get("tool")
    arguments = payload.get("arguments", {})

    if not tool_name:
        raise ValueError(f"Missing 'tool' key in payload: {payload}")

    # Hard guard: uniform entitlement never accepts group_by
    if tool_name == "uniform_entitlement_kpi":
        arguments.pop("group_by", None)

        # Drop empty time_range
        if "time_range" in arguments and not arguments["time_range"]:
            arguments.pop("time_range")

    request = {
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {
            "name": tool_name,
            "arguments": arguments
        },
        "id": 1
    }

    headers = {
        "Accept": "application/json, text/event-stream",
        "Content-Type": "application/json"
    }

    if DEBUG_MODE:
        print(f"[DEBUG] Calling MCP tool: {tool_name}")
        print(f"[DEBUG] Arguments: {json.dumps(arguments, indent=2)}")

    response = requests.post(
        MCP_URL,
        json=request,
        headers=headers,
        timeout=400
    )

    if response.status_code != 200:
        raise RuntimeError(f"MCP call failed: {response.status_code} {response.text}")

    for line in response.text.splitlines():
        if not line.startswith("data:"):
            continue

        raw = line.replace("data:", "", 1).strip()
        envelope = json.loads(raw)

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
                except Exception:
                    pass

    raise RuntimeError(
        f"No MCP JSON response found.\nRaw:\n{response.text}"
    )


# =========================================================
# CLI ENTRY
# =========================================================
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print('Usage: python agent_run.py "Your question here"')
        print('Add --debug flag for debug output')
        sys.exit(1)

    # Check for debug flag
    if "--debug" in sys.argv:
        DEBUG_MODE = True
        sys.argv.remove("--debug")

    query = " ".join(sys.argv[1:])

    try:
        result = run_agent(query)
        # Output only clean JSON
        print(json.dumps(result, indent=2))
    except Exception as e:
        error_result = {
            "error": str(e),
            "error_type": type(e).__name__
        }
        print(json.dumps(error_result, indent=2))
        sys.exit(1)