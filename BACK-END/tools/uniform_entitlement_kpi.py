from database import db
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

EMPLOYEE_TABLE = "active_and_inactive_employees_details_as_on_01_09_2025_sheet1"
ENTITLEMENT_TABLE = "entitlement_detail_entitlement"
LAST_ISSUE_DATE = "2025-08-31"

ENTITLEMENT_CTE = f"""
WITH entitlement_data AS (
    SELECT
        CASE
            WHEN UPPER(department) = 'AOCS'
                THEN 'Airport Operations & Customer Services'
            WHEN UPPER(department) IN ('INFLIGHTS', 'INFLIGHT')
                THEN 'Inflight Services'
            WHEN UPPER(department) = 'ENGINEERING'
                THEN 'Engineering'
            WHEN UPPER(department) = 'CARGO'
                THEN 'Cargo'
            ELSE TRIM(department)
        END AS department,
        TRIM(item_name) AS item_name,
        UPPER(TRIM(gender)) AS gender,
        TRIM(base_location) AS base_location,
        frequency,
        quantity
    FROM {ENTITLEMENT_TABLE}
)
"""

def uniform_entitlement_kpi_mcp(params):
    metric = params.get("metric")
    logger.info(f"uniform_entitlement_kpi_mcp received metric: '{metric}'")
    logger.info(f"Is metric == 'entitlement_coverage_matrix'? {metric == 'entitlement_coverage_matrix'}")

    filters = params.get("filters", {})
    time_range = params.get("time_range") or {}

    where_emp = ["LOWER(e.status) = 'active'"]
    where_ent = ["1=1"]
    sql_params = {}

    if metric == "unique_skus":
        """
        Total count of unique SKU items in the system
        """
        sql = f"""
        {ENTITLEMENT_CTE}
        SELECT COUNT(DISTINCT item_name) AS value
        FROM entitlement_data
        WHERE {' AND '.join(where_ent)}
        """
        return {
            "metric": metric,
            "message": "Total unique SKUs in the system",
            "data": db.execute_query(sql, sql_params)
        }
    elif metric == "skus_by_department":
        """
        SKU count grouped by department
        """
        if filters.get("department"):
            where_ent.append("LOWER(ed.department) = LOWER(:dept)")
            sql_params["dept"] = filters["department"]

        sql = f"""
        {ENTITLEMENT_CTE}
        SELECT 
            department,
            COUNT(DISTINCT item_name) AS sku_count,
            COUNT(*) AS total_entitlement_records
        FROM entitlement_data ed
        WHERE {' AND '.join(where_ent)}
        GROUP BY department
        ORDER BY sku_count DESC
        """
        return {
            "metric": metric,
            "filters": filters,
            "message": "SKU count by department",
            "data": db.execute_query(sql, sql_params)
        }
    elif metric == "skus_by_gender":
        """
        SKU count grouped by gender
        """
        if filters.get("department"):
            where_ent.append("LOWER(ed.department) = LOWER(:dept)")
            sql_params["dept"] = filters["department"]

        sql = f"""
        {ENTITLEMENT_CTE}
        SELECT 
            CASE 
                WHEN gender = 'M' THEN 'Male'
                WHEN gender = 'F' THEN 'Female'
                WHEN gender = 'B' THEN 'Both/Common'
                ELSE gender
            END AS gender,
            COUNT(DISTINCT item_name) AS sku_count
        FROM entitlement_data ed
        WHERE {' AND '.join(where_ent)}
        GROUP BY gender
        ORDER BY sku_count DESC
        """
        return {
            "metric": metric,
            "filters": filters,
            "message": "SKU count by gender",
            "data": db.execute_query(sql, sql_params)
        }
    elif metric == "skus_by_location":
        """
        SKU count grouped by base location
        """
        if filters.get("department"):
            where_ent.append("LOWER(ed.department) = LOWER(:dept)")
            sql_params["dept"] = filters["department"]

        sql = f"""
        {ENTITLEMENT_CTE}
        SELECT 
            base_location,
            COUNT(DISTINCT item_name) AS sku_count
        FROM entitlement_data ed
        WHERE {' AND '.join(where_ent)}
        GROUP BY base_location
        ORDER BY sku_count DESC
        """
        return {
            "metric": metric,
            "filters": filters,
            "message": "SKU count by location",
            "data": db.execute_query(sql, sql_params)
        }
    elif metric == "skus_by_frequency":
        """
        SKU count grouped by frequency (how often items are issued)
        """
        if filters.get("department"):
            where_ent.append("LOWER(ed.department) = LOWER(:dept)")
            sql_params["dept"] = filters["department"]

        sql = f"""
        {ENTITLEMENT_CTE}
        SELECT 
            frequency,
            CASE 
                WHEN frequency = 0 THEN 'One-time'
                WHEN frequency = 6 THEN 'Every 6 months'
                WHEN frequency = 12 THEN 'Every 12 months'
                WHEN frequency = 24 THEN 'Every 24 months'
                ELSE frequency || ' months'
            END AS frequency_label,
            COUNT(DISTINCT item_name) AS sku_count
        FROM entitlement_data ed
        WHERE {' AND '.join(where_ent)}
        GROUP BY frequency
        ORDER BY frequency
        """
        return {
            "metric": metric,
            "filters": filters,
            "message": "SKU count by frequency",
            "data": db.execute_query(sql, sql_params)
        }
    elif metric == "entitlement_coverage_matrix":
        # First, get all unique, normalized departments
        dept_sql = f"""
        {ENTITLEMENT_CTE}
        SELECT DISTINCT department FROM entitlement_data ORDER BY department
        """
        dept_rows = db.execute_query(dept_sql, {})
        departments = [row['department'] for row in dept_rows]

        # Build dynamic CASE statements for the pivot
        case_statements = []
        for dept in departments:
            # The column name needs to be quoted to handle special characters
            new_line = "MAX(CASE WHEN department = '" + dept.replace("'", "''") + "' THEN 1 ELSE 0 END) AS \"" + dept + "\" "
            case_statements.append(new_line)

        case_sql = ', '.join(case_statements)

        # Build the final pivot query
        sql = f"""
        {ENTITLEMENT_CTE}
        SELECT
            item_name AS \"SKU Name\",
            {case_sql}
        FROM entitlement_data
        GROUP BY item_name
        ORDER BY item_name
        """

        result_data = db.execute_query(sql, {})
        
        matrix_data = {}
        for row in result_data:
            sku_name = row.pop("SKU Name")
            matrix_data[sku_name] = row

        return {
            "metric": metric,
            "message": "Entitlement coverage matrix showing which SKUs apply to which departments.",
            "data": matrix_data
        }
    elif metric == "sku_demand":
        """
        Calculate SKU demand based on:
        - Employee joining dates
        - Frequency (how often items are issued)
        - Quantity per issuance
        - Supports date ranges OR specific months
        """
        
        # Handle specific months OR date range
        specific_months = filters.get("months", [])  # e.g., ["2025-09", "2025-12", "2026-03"]
        
        if specific_months:
            # Specific months mode
            month_conditions = []
            for i, month in enumerate(specific_months):
                param_name = f"month_{i}"
                month_conditions.append(f"strftime('%Y-%m', date(e.dateofjoining, '+' || (nums.n * ed.frequency) || ' months')) = :{param_name}")
                sql_params[param_name] = month
            
            date_filter = f"({' OR '.join(month_conditions)})"
            sql_params["last_issue_date"] = LAST_ISSUE_DATE
            
        elif time_range.get("from") and time_range.get("to"):
            # Date range mode
            start_ym = time_range["from"]
            end_ym = time_range["to"]
            
            try:
                start_dt = datetime.strptime(start_ym, "%Y-%m")
                end_dt = datetime.strptime(end_ym, "%Y-%m")
                last_issue_dt = datetime.strptime("2025-08", "%Y-%m")
                
                if end_dt <= last_issue_dt:
                    return {
                        "metric": metric, 
                        "message": "Please select dates after Aug 2025 for future demand", 
                        "data": []
                    }
            except Exception:
                return {
                    "metric": metric, 
                    "message": "Invalid date format. Use YYYY-MM", 
                    "data": []
                }
            
            date_filter = """
                date(e.dateofjoining, '+' || (nums.n * ed.frequency) || ' months') BETWEEN :start_date AND :end_date
                AND date(e.dateofjoining, '+' || (nums.n * ed.frequency) || ' months') > :last_issue_date
            """
            sql_params["start_date"] = f"{start_ym}-01"
            sql_params["end_date"] = f"{end_ym}-31"
            sql_params["last_issue_date"] = LAST_ISSUE_DATE
        else:
            return {
                "metric": metric, 
                "message": "Please provide either 'time_range' (from/to) or 'months' array", 
                "data": []
            }

        # Apply department filter
        if filters.get("department"):
            where_emp.append("LOWER(e.function) = LOWER(:dept)")
            sql_params["dept"] = filters["department"]
        
        # Apply gender filter
        if filters.get("gender"):
            where_emp.append("LOWER(e.gender_picklist_label) = LOWER(:gender)")
            sql_params["gender"] = filters["gender"]
        
        # Apply SKU filter
        if filters.get("sku"):
            where_ent.append("LOWER(ed.item_name) = LOWER(:sku)")
            sql_params["sku"] = filters["sku"]
        
        # Only items with frequency > 0 (recurring items)
        where_ent.append("ed.frequency > 0")

        sql = f"""
        {ENTITLEMENT_CTE}
        , months_generator AS (
            SELECT 0 AS n UNION ALL SELECT 1 UNION ALL SELECT 2 
            UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5
            UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8
            UNION ALL SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 11
            UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14
            UNION ALL SELECT 15 UNION ALL SELECT 16 UNION ALL SELECT 17
            UNION ALL SELECT 18 UNION ALL SELECT 19 UNION ALL SELECT 20
        ),
        employee_sku_occurrences AS (
            SELECT 
                ed.department,
                ed.item_name,
                ed.frequency,
                ed.quantity,
                ed.base_location,
                ed.gender AS sku_gender,
                e.iga_code,
                e.dateofjoining,
                e.gender_picklist_label,
                e.baselocationtext,
                COUNT(*) as occurrence_count
            FROM {EMPLOYEE_TABLE} e
            JOIN entitlement_data ed 
                ON LOWER(e.function) = LOWER(ed.department)
            CROSS JOIN months_generator nums
            WHERE {' AND '.join(where_emp)}
              AND {' AND '.join(where_ent)}
              AND (ed.gender = 'B' OR UPPER(SUBSTR(e.gender_picklist_label, 1, 1)) = ed.gender)
              AND {date_filter}
            GROUP BY 
                ed.department, 
                ed.item_name, 
                ed.frequency, 
                ed.quantity,
                ed.base_location,
                ed.gender,
                e.iga_code,
                e.dateofjoining,
                e.gender_picklist_label,
                e.baselocationtext
        )
        SELECT 
            department,
            item_name,
            frequency,
            CASE 
                WHEN sku_gender = 'M' THEN 'Male'
                WHEN sku_gender = 'F' THEN 'Female'
                WHEN sku_gender = 'B' THEN 'Both/Common'
                ELSE sku_gender
            END AS sku_gender,
            base_location,
            quantity AS quantity_per_issue,
            COUNT(DISTINCT iga_code) AS unique_employees,
            SUM(occurrence_count) AS total_occurrences,
            SUM(occurrence_count * quantity) AS total_quantity_needed
        FROM employee_sku_occurrences
        GROUP BY 
            department, 
            item_name, 
            frequency, 
            quantity,
            base_location,
            sku_gender
        ORDER BY total_quantity_needed DESC
        """
        
        result_data = db.execute_query(sql, sql_params)
        
        # Calculate common vs department-specific SKUs
        common_skus = [row for row in result_data if row.get('sku_gender') == 'Both/Common']
        dept_specific = [row for row in result_data if row.get('sku_gender') != 'Both/Common']
        
        return {
            "metric": metric,
            "filters": filters,
            "time_range": time_range if not specific_months else None,
            "specific_months": specific_months if specific_months else None,
            "message": "SKU demand calculation",
            "summary": {
                "total_skus": len(result_data),
                "common_skus": len(common_skus),
                "department_specific_skus": len(dept_specific),
                "total_quantity": sum(row.get('total_quantity_needed', 0) for row in result_data)
            },
            "data": result_data
        }
    elif metric == "employees_with_demand":
        if not time_range.get("from") or not time_range.get("to"):
            return {"metric": metric, "message": "Please add date range", "data": []}

        start_ym = time_range["from"]
        end_ym = time_range["to"]

        sql_params["start_date"] = f"{start_ym}-01"
        sql_params["end_date"] = f"{end_ym}-31"
        sql_params["last_issue_date"] = LAST_ISSUE_DATE

        if filters.get("department"):
            where_emp.append("LOWER(e.function) = LOWER(:dept)")
            sql_params["dept"] = filters["department"]
        
        where_ent.append("ed.frequency > 0")

        sql = f"""
        {ENTITLEMENT_CTE}
        , employees_with_items AS (
            SELECT DISTINCT
                e.iga_code,
                e.gender_picklist_label
            FROM {EMPLOYEE_TABLE} e
            JOIN entitlement_data ed 
                ON LOWER(e.function) = LOWER(ed.department)
            WHERE {' AND '.join(where_emp)}
              AND {' AND '.join(where_ent)}
              AND (ed.gender = 'B' OR UPPER(SUBSTR(e.gender_picklist_label, 1, 1)) = ed.gender)
              AND (UPPER(ed.base_location) = 'ALL' OR LOWER(ed.base_location) = LOWER(e.baselocationtext))
              AND EXISTS (
                  SELECT 1 
                  FROM ( 
                      SELECT 0 AS n UNION ALL SELECT 1 UNION ALL SELECT 2 
                      UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5
                      UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8
                      UNION ALL SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 11
                      UNION ALL SELECT 12
                  ) AS nums
                  WHERE date(e.dateofjoining, '+' || (nums.n * ed.frequency) || ' months') > :last_issue_date
                    AND date(e.dateofjoining, '+' || (nums.n * ed.frequency) || ' months') 
                        BETWEEN :start_date AND :end_date
              )
        )
        SELECT
            gender_picklist_label as gender,
            COUNT(DISTINCT iga_code) as employees_with_demand
        FROM employees_with_items
        GROUP BY gender_picklist_label
        
        UNION ALL
        
        SELECT
            'TOTAL' as gender,
            COUNT(DISTINCT iga_code) as employees_with_demand
        FROM employees_with_items
        
        ORDER BY gender
        """
        
        return {
            "metric": metric,
            "filters": filters,
            "time_range": time_range,
            "message": "Total unique employees who will receive items in date range",
            "data": db.execute_query(sql, sql_params)
        }
    elif metric == "all_uniform_entitlements":
        """
        Complete list of uniform entitlement rules for local filtering.
        """
        sql = f"""
        {ENTITLEMENT_CTE}
        SELECT 
            item_name AS sku,
            department,
            CASE 
                WHEN gender = 'M' THEN 'Male'
                WHEN gender = 'F' THEN 'Female'
                WHEN gender = 'B' THEN 'All'
                ELSE gender
            END AS gender,
            base_location,
            frequency
        FROM entitlement_data
        WHERE {' AND '.join(where_ent)}
        ORDER BY department, item_name
        """
        return {
            "final": True,
            "status": "success",
            "metric": metric,
            "message": "Complete list of uniform entitlement rules for local filtering.",
            "data": db.execute_query(sql, sql_params)
        }
    elif metric == "total_employees":
        if filters.get("department"):
            where_emp.append("LOWER(e.function) = LOWER(:dept)")
            sql_params["dept"] = filters["department"]

        sql = f"""
        SELECT
            e.gender_picklist_label as gender,
            COUNT(DISTINCT e.iga_code) as total_active
        FROM {EMPLOYEE_TABLE} e
        WHERE {' AND '.join(where_emp)}
        GROUP BY e.gender_picklist_label
        
        UNION ALL
        
        SELECT
            'TOTAL' as gender,
            COUNT(DISTINCT e.iga_code) as total_active
        FROM {EMPLOYEE_TABLE} e
        WHERE {' AND '.join(where_emp)}
        
        ORDER BY gender
        """
        
        return {
            "metric": metric,
            "filters": filters,
            "message": "Total active employees",
            "data": db.execute_query(sql, sql_params)
        }
    else:
        raise ValueError(f"Unsupported metric: {metric}")
