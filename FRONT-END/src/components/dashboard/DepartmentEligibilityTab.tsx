import { useMemo } from 'react';
import { Building2, CheckCircle, XCircle } from 'lucide-react';
import {
  BarChart,
  Bar,
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
import { getDepartmentEligibility, DepartmentEligibility } from '@/data/mockData';

export function DepartmentEligibilityTab() {
  const departmentEligibility = useMemo(
    () => getDepartmentEligibility(),
    []
  );

  // ================= KPI VALUES =================
  const totalDepartments = departmentEligibility.length;
  const eligibleDepartments = departmentEligibility.filter(
    (d) => d.isEligible
  ).length;
  const ineligibleDepartments =
    totalDepartments - eligibleDepartments;

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
          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            item.isEligible
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
      </div>

      {/* ================= BAR CHART ================= */}
      <ChartCard
        title="Number of Eligible Departments vs Number of Ineligible Departments"
        description="Department eligibility breakdown"
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
                <cell
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
