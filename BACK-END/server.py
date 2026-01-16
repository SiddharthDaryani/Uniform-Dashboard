import logging
from fastmcp import FastMCP
from tools.uniform_entitlement_kpi import uniform_entitlement_kpi_mcp
from tools.employee_kpi import employee_kpi_mcp
from database import db


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("employee-kpi-mcp")


mcp = FastMCP(
    "employee_kpi_mcp"
)


@mcp.tool()
def employee_kpi(
    metric: str = "total",
    group_by: str = "none",
    filters: dict | None = None,
    time_range: dict | None = None
):
    """
    Employee KPI MCP Tool

    This signature is CRITICAL for FastMCP + Azure Foundry.
    Arguments MUST be flat.
    """

    logger.info("employee_kpi tool called")

    params = {
        "metric": metric,
        "group_by": group_by,
        "filters": filters or {},
        "time_range": time_range
    }

    logger.info(f"normalized params = {params}")

    try:
        data = employee_kpi_mcp(params)

        return {
            "content": [{
                "type": "json",
                "json": {
                    "final": True,
                    "status": "success",
                    **data
                }
            }]
        }

    except Exception as e:
        logger.exception("employee_kpi failed")

        return {
            "content": [{
                "type": "json",
                "json": {
                    "final": True,
                    "status": "error",
                    "reason": str(e)
                }
            }]
        }

@mcp.tool()
def uniform_entitlement_kpi(
    metric: str,
    filters: dict | None = None,
    time_range: dict | None = None
):
    logger.info("uniform_entitlement_kpi tool called")

    params = {
        "metric": metric,
        "filters": filters or {},
        "time_range": time_range
    }
    try:
        data = uniform_entitlement_kpi_mcp(params)

        return {
            "content": [{
                "type": "json",
                "json": {
                    "final": True,
                    "status": "success",
                    **data
                }
            }]
        }
    except Exception as e:
        logger.exception("uniform kpi failed")
        return {
            "content": [{
                "type": "json",
                "json": {
                    "final": True,
                    "status": "error",
                    "reason": str(e)
                }
            }]
        }


def startup():
    logger.info("Starting Employee KPI MCP Server...")
    tables = db.get_table_info()
    logger.info(f"Connected tables: {list(tables.keys())}")
    logger.info("✅ MCP ready")



if __name__ == "__main__":
    mcp.run(
        transport="streamable-http",
        host="127.0.0.1",
        port=8000,
        path="/mcp",
        stateless_http=True
    )
