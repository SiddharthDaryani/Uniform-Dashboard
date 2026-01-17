from database import db

# -------------------------------
# TABLES
# -------------------------------
EMPLOYEE_TABLE = "active_and_inactive_employees_details_as_on_01_09_2025_sheet1"
ENTITLEMENT_TABLE = "entitlement_detail_entitlement"


# -------------------------------
# HELPER: NORMALIZED ELIGIBLE DEPARTMENTS
# -------------------------------
ELIGIBLE_DEPARTMENTS_CTE = f"""
WITH entitlement_departments AS (
    SELECT DISTINCT
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
        END AS normalized_department
    FROM {ENTITLEMENT_TABLE}
)
"""


# =================================================
# MAIN KPI FUNCTION
# =================================================
def employee_kpi_mcp(params):
    metric = params.get("metric", "total").strip().lower()
    group_by = params.get("group_by", "none")
    filters = params.get("filters", {})
    time_range = params.get("time_range")

    where = ["1=1"]
    sql_params = {}

    # -------------------------------------------------
    # 🕐 TIME RANGE (LIFECYCLE)
    # -------------------------------------------------
    if time_range:
        from_month = time_range.get("from")
        to_month = time_range.get("to")

        if from_month and to_month:
            where.append("dateofjoining <= :month_end")
            where.append("""
                (
                    dateofrelieving IS NULL
                    OR dateofrelieving >= :month_start
                )
            """)
            sql_params["month_start"] = f"{from_month}-01"
            sql_params["month_end"] = f"{to_month}-31"

    # -------------------------------------------------
    # 🎯 FILTERS
    # -------------------------------------------------
    if filters.get("department"):
        where.append("LOWER(function) = LOWER(:department)")
        sql_params["department"] = filters["department"]

    if filters.get("gender"):
        where.append("LOWER(gender_picklist_label) = LOWER(:gender)")
        sql_params["gender"] = filters["gender"]

    if filters.get("location"):
        where.append("LOWER(baselocationtext) = LOWER(:location)")
        sql_params["location"] = filters["location"]

    if filters.get("status"):
        where.append("LOWER(status) = LOWER(:status)")
        sql_params["status"] = filters["status"]

    # =================================================
    # METRIC-BASED LOGIC
    # =================================================
    if metric == "department_eligibility":
        sql = f"""
        {ELIGIBLE_DEPARTMENTS_CTE}
        SELECT
            e.function AS department,
            CASE
                WHEN ed.normalized_department IS NOT NULL
                 AND COUNT(
                     DISTINCT CASE
                         WHEN LOWER(e.status) = 'active'
                         THEN e.iga_code
                     END
                 ) > 0
                THEN 'Eligible'
                ELSE 'Ineligible'
            END AS eligibility_status,
            COUNT(DISTINCT e.iga_code) AS total_employees,
            COUNT(
                DISTINCT CASE
                    WHEN LOWER(e.status) = 'active'
                    THEN e.iga_code
                END
            ) AS active_employees
        FROM {EMPLOYEE_TABLE} e
        LEFT JOIN entitlement_departments ed
            ON LOWER(e.function) = LOWER(ed.normalized_department)
        WHERE {' AND '.join(where)}
        GROUP BY e.function, ed.normalized_department
        ORDER BY e.function
        """
        return {
            "success": True,
            "metric": metric,
            "data": db.execute_query(sql, sql_params)
        }
    elif metric == "eligible_employees":
        select = "COUNT(DISTINCT e.iga_code) AS value"
        group = ""
        
        # Local where for this block
        local_where = list(where)

        if group_by == "gender":
            select = "e.gender_picklist_label AS gender, COUNT(DISTINCT e.iga_code) AS value"
            group = "GROUP BY e.gender_picklist_label"
        elif group_by == "department":
            select = "e.function AS department, COUNT(DISTINCT e.iga_code) AS value"
            group = "GROUP BY e.function"
        elif group_by == "location":
            select = "e.baselocationtext AS location, COUNT(DISTINCT e.iga_code) AS value"
            group = "GROUP BY e.baselocationtext"
        elif group_by == "status":
            select = "e.status AS label, COUNT(DISTINCT e.iga_code) AS value"
            group = "GROUP BY e.status"
            
        # Default to active only if no explicit status filter AND not grouping by status
        if not filters.get("status") and group_by != "status":
            local_where.append("LOWER(e.status) = 'active'")

        sql = f"""
        {ELIGIBLE_DEPARTMENTS_CTE}
        SELECT {select}
        FROM {EMPLOYEE_TABLE} e
        JOIN entitlement_departments ed
            ON LOWER(e.function) = LOWER(ed.normalized_department)
        WHERE {' AND '.join(local_where)}
        {group}
        """
        data = db.execute_query(sql, sql_params)
        
        final_metric = metric
        final_group_by = group_by
        
        if group_by == "status":
            final_metric = "status"
            final_group_by = "none" # Match user expectation
            
            # Ensure both Active and Inactive are present
            labels = {str(item.get("label", "")).lower(): item for item in data}
            new_data = []
            
            # Use specific labels from user's request
            status_map = {"active": "Active", "inactive": "Inactive"}
            for key, display in status_map.items():
                if key in labels:
                    # Clean up the label if needed
                    labels[key]["label"] = display
                    new_data.append(labels[key])
                else:
                    new_data.append({"label": display, "value": 0})
            data = new_data

        return {
            "success": True,
            "metric": final_metric,
            "group_by": final_group_by,
            "filters": filters,
            "time_range": time_range,
            "data": data
        }
    elif metric == "ineligible_employees":
        sql = f"""
        {ELIGIBLE_DEPARTMENTS_CTE}
        SELECT COUNT(DISTINCT e.iga_code) AS value
        FROM {EMPLOYEE_TABLE} e
        LEFT JOIN entitlement_departments ed
            ON LOWER(e.function) = LOWER(ed.normalized_department)
        WHERE LOWER(e.status) = 'active'
          AND ed.normalized_department IS NULL
          AND {' AND '.join(where)}
        """
        return {
            "success": True,
            "metric": metric,
            "data": db.execute_query(sql, sql_params)
        }
    elif metric == "eligible_departments":
        sql = f"""
        {ELIGIBLE_DEPARTMENTS_CTE}
        SELECT COUNT(DISTINCT normalized_department) AS value
        FROM entitlement_departments
        """
        return {
            "success": True,
            "metric": metric,
            "data": db.execute_query(sql, {})
        }
    elif metric == "total_departments":
        sql = f"""
        SELECT COUNT(DISTINCT function) AS value
        FROM {EMPLOYEE_TABLE}
        """
        return {
            "success": True,
            "metric": metric,
            "data": db.execute_query(sql, {})
        }
    elif metric == "eligibility_by_gender":
        # Redirect to unified grouping logic
        params["metric"] = "eligible_employees"
        params["group_by"] = "gender"
        return employee_kpi_mcp(params)
    elif metric == "eligibility_trend":
        trend_where = list(where)
        # Default to active if no status filter provided
        if not filters.get("status"):
            trend_where.append("LOWER(e.status) = 'active'")
        
        trend_where.append("ed.normalized_department IS NOT NULL")

        if time_range:
            trend_where.append(
                "e.dateofjoining BETWEEN :start_date AND :end_date"
            )
            sql_params["start_date"] = f"{time_range['from']}-01"
            sql_params["end_date"] = f"{time_range['to']}-31"

        sql = f"""
        {ELIGIBLE_DEPARTMENTS_CTE}
        SELECT
            strftime('%Y-%m', e.dateofjoining) AS month,
            COUNT(DISTINCT e.iga_code) AS eligible_employees
        FROM {EMPLOYEE_TABLE} e
        JOIN entitlement_departments ed
            ON LOWER(e.function) = LOWER(ed.normalized_department)
        WHERE {' AND '.join(trend_where)}
        GROUP BY month
        ORDER BY month
        """
        return {
            "success": True,
            "metric": metric,
            "data": db.execute_query(sql, sql_params)
        }
    elif metric == "headcount_vs_eligibility":
        trend_where = list(where)
        # Default to active if no status filter provided
        if not filters.get("status"):
            trend_where.append("LOWER(e.status) = 'active'")

        if time_range:
            trend_where.append(
                "e.dateofjoining BETWEEN :start_date AND :end_date"
            )
            sql_params["start_date"] = f"{time_range['from']}-01"
            sql_params["end_date"] = f"{time_range['to']}-31"

        sql = f"""
        {ELIGIBLE_DEPARTMENTS_CTE}
        SELECT
            strftime('%Y-%m', e.dateofjoining) AS month,
            COUNT(DISTINCT e.iga_code) AS total_headcount,
            COUNT(
                DISTINCT CASE
                    WHEN ed.normalized_department IS NOT NULL
                    THEN e.iga_code
                END
            ) AS eligible_headcount
        FROM {EMPLOYEE_TABLE} e
        LEFT JOIN entitlement_departments ed
            ON LOWER(e.function) = LOWER(ed.normalized_department)
        WHERE {' AND '.join(trend_where)}
        GROUP BY month
        ORDER BY month
        """
        return {
            "success": True,
            "metric": metric,
            "data": db.execute_query(sql, sql_params)
        }
    elif metric == "department_summary":
        sql = f"""
        SELECT
            function AS department,
            COUNT(DISTINCT iga_code) AS total_employees,
            COUNT(DISTINCT CASE WHEN LOWER(status) = 'active' THEN iga_code END) AS active_employees,
            COUNT(DISTINCT CASE WHEN LOWER(status) = 'inactive' THEN iga_code END) AS inactive_employees,
            COUNT(DISTINCT baselocationtext) AS number_of_locations_present
        FROM {EMPLOYEE_TABLE} e
        WHERE {' AND '.join(where)}
        GROUP BY function
        ORDER BY function
        """
        return {
            "success": True,
            "metric": metric,
            "group_by": "department",
            "filters": filters,
            "data": db.execute_query(sql, sql_params)
        }
    else:
        # =================================================
        # 🟨 STANDARD KPIs - FIXED FOR SPECIFIC QUERIES
        # =================================================
        
        if metric == "total":
            select = "COUNT(DISTINCT iga_code) AS value"
            group = ""
        elif metric == "active":
            select = "COUNT(DISTINCT iga_code) AS value"
            if not filters.get("status"):
                where.append("LOWER(status) = 'active'")
            group = ""
        elif metric == "inactive":
            select = "COUNT(DISTINCT iga_code) AS value"
            if not filters.get("status"):
                where.append("LOWER(status) = 'inactive'")
            group = ""
        elif metric == "status":
            select = "status AS label, COUNT(DISTINCT iga_code) AS value"
            group = "GROUP BY status"
        else:
            select = "COUNT(DISTINCT iga_code) AS value"
            group = ""

        # -------------------------------------------------
        # 📂 Grouping logic
        # -------------------------------------------------
        if group_by == "department":
            if metric == "inactive":
                select = """
                    function AS department,
                    COUNT(DISTINCT iga_code) AS inactive_employees,
                    COUNT(DISTINCT baselocationtext) AS number_of_locations_present
                """
            elif metric == "active":
                select = """
                    function AS department,
                    COUNT(DISTINCT iga_code) AS active_employees,
                    COUNT(DISTINCT baselocationtext) AS number_of_locations_present
                """
            else:
                select = """
                    function AS department,
                    COUNT(DISTINCT iga_code) AS total_employees,
                    COUNT(DISTINCT CASE WHEN LOWER(status) = 'active' THEN iga_code END) AS active_employees,
                    COUNT(DISTINCT CASE WHEN LOWER(status) = 'inactive' THEN iga_code END) AS inactive_employees,
                    COUNT(DISTINCT baselocationtext) AS number_of_locations_present
                """
            group = "GROUP BY function"
        elif group_by == "gender":
            if metric == "inactive":
                select = """
                    gender_picklist_label AS gender,
                    COUNT(DISTINCT iga_code) AS inactive_employees
                """
            elif metric == "active":
                select = """
                    gender_picklist_label AS gender,
                    COUNT(DISTINCT iga_code) AS active_employees
                """
            else:
                select = """
                    gender_picklist_label AS gender,
                    COUNT(DISTINCT iga_code) AS value
                """
            group = "GROUP BY gender_picklist_label"
        elif group_by == "location":
            if metric == "inactive":
                select = """
                    baselocationtext AS location,
                    COUNT(DISTINCT iga_code) AS inactive_employees
                """
            elif metric == "active":
                select = """
                    baselocationtext AS location,
                    COUNT(DISTINCT iga_code) AS active_employees
                """
            else:
                select = """
                    baselocationtext AS location,
                    COUNT(DISTINCT iga_code) AS value
                """
            group = "GROUP BY baselocationtext"

        sql = f"""
        SELECT {select}
        FROM {EMPLOYEE_TABLE}
        WHERE {' AND '.join(where)}
        {group}
        """

        return {
            "success": True,
            "metric": metric,
            "group_by": group_by,
            "filters": filters,
            "time_range": time_range,
            "data": db.execute_query(sql, sql_params)
        }