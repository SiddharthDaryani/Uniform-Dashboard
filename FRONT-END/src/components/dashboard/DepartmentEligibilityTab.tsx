import { useMemo } from 'react';
import { Building2, CheckCircle, XCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query'; // ✅ IMPORT
import { fetchDashboardData } from '@/lib/api'; // ✅ IMPORT
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

import { KPICard } from './KPICard';
import { ChartCard } from './ChartCard';
import { DataTable } from './DataTable';
import { DepartmentEligibility } from '@/data/mockData';

export function DepartmentEligibilityTab() {
  // ================= API QUERIES =================
  const { data: totalDeptsData, isLoading: isLoadingTotal } = useQuery({
    queryKey: ['totalDepts'],
    queryFn: () => fetchDashboardData('total number of departments'),
  });

  const { data: eligibleDeptsData, isLoading: isLoadingEligDepts } = useQuery({
    queryKey: ['eligibleDepts_page'],
    queryFn: () => fetchDashboardData('total number of eligible departments'),
  });

  const { data: deptEligibilityData } = useQuery({
    queryKey: ['deptEligibilityTable'],
    queryFn: () => fetchDashboardData('department eligibility summary'),
  });

  // KPI Calculations
  const totalDepartments = totalDeptsData?.data?.[0]?.value || 0;
  const eligibleDepartments = eligibleDeptsData?.data?.[0]?.value || 0;
  const ineligibleDepartments = totalDepartments - eligibleDepartments;

  // Table Data Processing
  // Hardcoded eligible departments
  const ELIGIBLE_DEPARTMENTS = [
    'Airport Operations & Customer Services',
    'Cargo',
    'Engineering',
    'Inflight Services'
  ];

  const departmentEligibility = deptEligibilityData?.data?.map((item: any) => {
    const deptName = item.department || item.name;

    return {
      department: deptName,
      totalEmployees: item.total_employees || item.totalEmployees || item.total || 0,
      activeEmployees: item.active_employees || item.activeEmployees || item.active || 0,
      // Hardcode eligibility based on department name
      isEligible: ELIGIBLE_DEPARTMENTS.includes(deptName),
    };
  }) || [];

  // ================= CHART DATA (EXACT FIRST UI) =================
  const chartData = [
    {
      name: 'Eligible Departments',
      count: eligibleDepartments,
    },
    {
      name: 'Ineligible Departments',
      count: ineligibleDepartments,
    },
  ];

  // ================= TABLE COLUMNS =================
  const tableColumns = [
    { key: 'department', header: 'Department Name' },
    {
      key: 'isEligible',
      header: 'Eligibility Status',
      render: (item: DepartmentEligibility) => (
        <span
          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${item.isEligible
            ? 'bg-green-100 text-green-700'
            : 'bg-red-100 text-red-700'
            }`}
        >
          {item.isEligible ? (
            <>
              <CheckCircle className="h-3 w-3 mr-1" />
              Eligible
            </>
          ) : (
            <>
              <XCircle className="h-3 w-3 mr-1" />
              Ineligible
            </>
          )}
        </span>
      ),
    },
    {
      key: 'totalEmployees',
      header: 'Total Employees',
      className: 'text-right',
    },
    {
      key: 'activeEmployees',
      header: 'Active Employees',
      className: 'text-right',
    },
  ];

  return (
    <div className="space-y-6">
      {/* ================= KPI ================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard
          title="Total Departments"
          value={totalDepartments}
          icon={Building2}
        />
        <KPICard
          title="Eligible Departments"
          value={isLoadingEligDepts ? '...' : eligibleDepartments}
          variant="success"
          icon={CheckCircle}
        />
        <KPICard
          title="Ineligible Departments"
          value={isLoadingEligDepts ? '...' : ineligibleDepartments}
          variant="destructive"
          icon={XCircle}
        />
      </div>

      {/* ================= BAR CHART ================= */}
      <ChartCard
        title="Number of Eligible Departments vs Number of Ineligible Departments"
      >
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
            />
            <XAxis
              dataKey="name"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
              allowDecimals={false}
            />
            <Tooltip />
            <Legend />
            <Bar
              dataKey="count"
              name="Departments"
              radius={[6, 6, 0, 0]}
              fill="hsl(var(--success))"
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={index}
                  fill={
                    entry.name === 'Eligible Departments'
                      ? 'hsl(var(--success))'
                      : 'hsl(var(--destructive))'
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ================= TABLE ================= */}
      <DataTable
        data={departmentEligibility}
        columns={tableColumns}
        title="Department Summary"
      />
    </div>
  );
}
