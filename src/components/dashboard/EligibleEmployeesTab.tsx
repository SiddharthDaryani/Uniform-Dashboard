import { useState, useMemo } from 'react';
import { Users, UserCheck, Percent, Building2 } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

import { KPICard } from './KPICard';
import { FilterPanel } from './FilterPanel';
import { ChartCard } from './ChartCard';
import { DataTable } from './DataTable';

import {
  employees,
  departments,
  locations,
  genders,
  months,
  EligibleEmployeeSummary,
} from '@/data/mockData';

const COLORS = [
  'hsl(217, 91%, 60%)',
  'hsl(262, 83%, 58%)',
  'hsl(142, 76%, 36%)',
  'hsl(38, 92%, 50%)',
  'hsl(173, 80%, 40%)',
];

export function EligibleEmployeesTab() {
  // ✅ MULTI-SELECT DEPARTMENT
  const [deptFilter, setDeptFilter] = useState<string[]>([]);

  // ✅ MULTI-SELECT LOCATION
  const [locationFilter, setLocationFilter] = useState<string[]>([]);

  const [genderFilter, setGenderFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');

  // ================= FILTERED DATA =================
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (deptFilter.length > 0 && !deptFilter.includes(emp.department))
        return false;

      if (locationFilter.length > 0 && !locationFilter.includes(emp.location))
        return false;

      if (genderFilter !== 'all' && emp.gender !== genderFilter) return false;

      if (
        monthFilter !== 'all' &&
        !emp.issuanceMonth.includes(monthFilter.split(' ')[0])
      )
        return false;

      return true;
    });
  }, [deptFilter, locationFilter, genderFilter, monthFilter]);

  // ================= KPI VALUES =================
  const totalEmployees = filteredEmployees.length;
  const eligibleEmployees = filteredEmployees.filter(
    (e) => e.isEligible
  ).length;

  const eligibilityRate =
    totalEmployees > 0
      ? Math.round((eligibleEmployees / totalEmployees) * 100)
      : 0;

  const totalDepartments = useMemo(() => {
    return departments.filter((dept) =>
      filteredEmployees.some((e) => e.department === dept)
    ).length;
  }, [filteredEmployees]);

  // ================= CHART DATA =================
  const eligibleByDept = useMemo(() => {
    return departments
      .map((dept) => ({
        department: dept.length > 10 ? dept.slice(0, 10) + '...' : dept,
        fullName: dept,
        count: filteredEmployees.filter(
          (e) => e.department === dept && e.isEligible
        ).length,
      }))
      .filter((d) => d.count > 0);
  }, [filteredEmployees]);

  const eligibleByMonth = useMemo(() => {
    return months.map((month) => ({
      month: month.split(' ')[0],
      count: filteredEmployees.filter(
        (e) =>
          e.issuanceMonth.includes(month.split(' ')[0]) && e.isEligible
      ).length,
    }));
  }, [filteredEmployees]);

  const headcountTrend = useMemo(() => {
    return months.map((month) => {
      const monthEmp = filteredEmployees.filter((e) =>
        e.issuanceMonth.includes(month.split(' ')[0])
      );
      return {
        month: month.split(' ')[0],
        totalHeadcount: monthEmp.length,
        eligibleEmployees: monthEmp.filter((e) => e.isEligible).length,
      };
    });
  }, [filteredEmployees]);

  const eligibleByGender = useMemo(() => {
    return genders
      .map((gender, i) => ({
        name: gender,
        value: filteredEmployees.filter(
          (e) => e.gender === gender && e.isEligible
        ).length,
        fill: COLORS[i % COLORS.length],
      }))
      .filter((g) => g.value > 0);
  }, [filteredEmployees]);

  // ================= TABLE =================
  const tableData: EligibleEmployeeSummary[] = useMemo(() => {
    return departments
      .map((dept) => {
        const deptEmp = filteredEmployees.filter(
          (e) => e.department === dept
        );
        const eligibleCount = deptEmp.filter((e) => e.isEligible).length;
        const activeCount = deptEmp.filter(
          (e) => e.status === 'Active'
        ).length;

        return {
          department: dept,
          totalHeadcount: deptEmp.length,
          activeHeadcount: activeCount,
          eligibleHeadcount: eligibleCount,
          eligibilityPercentage:
            deptEmp.length > 0
              ? Math.round((eligibleCount / deptEmp.length) * 100)
              : 0,
        };
      })
      .filter((d) => d.totalHeadcount > 0);
  }, [filteredEmployees]);

  // ================= FILTER CONFIG =================
  const filters = [
    {
      id: 'department',
      label: 'Department',
      options: departments.map((d) => ({ value: d, label: d })),
      value: deptFilter,
      onChange: setDeptFilter,
      multi: true, // ✅ CHECKBOX
    },
    {
      id: 'location',
      label: 'Location',
      options: locations.map((l) => ({ value: l, label: l })),
      value: locationFilter,
      onChange: setLocationFilter,
      multi: true,
    },
    {
      id: 'gender',
      label: 'Gender',
      options: [
        { value: 'all', label: 'All Genders' },
        ...genders.map((g) => ({ value: g, label: g })),
      ],
      value: genderFilter,
      onChange: setGenderFilter,
    },
    {
      id: 'month',
      label: 'Issuance Month',
      options: [
        { value: 'all', label: 'All Months' },
        ...months.map((m) => ({ value: m, label: m })),
      ],
      value: monthFilter,
      onChange: setMonthFilter,
    },
  ];

  const resetFilters = () => {
    setDeptFilter([]);
    setLocationFilter([]);
    setGenderFilter('all');
    setMonthFilter('all');
  };

  const eligibleDepartmentsCount = useMemo(() => {
    const eligibleDeptSet = new Set(
      filteredEmployees
         .filter((e) => e.isEligible)
         .map((e) => e.department)
    );
   return eligibleDeptSet.size;
 }, [filteredEmployees]);


  // ================= UI =================
  return (
    <div className="space-y-6">
      <FilterPanel filters={filters} onReset={resetFilters} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Employees" value={totalEmployees} icon={Users} />
        <KPICard title="Eligible Employees" value={eligibleEmployees} icon={UserCheck} variant="success" />
        <KPICard title="Eligibility Rate" value={`${eligibilityRate}%`} icon={Percent} />
        <KPICard title="Eligible Departments" value={eligibleDepartmentsCount} icon={Building2} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Eligible Employees by Department">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={eligibleByDept}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="department" />
              <YAxis />
              <Tooltip formatter={(v, _, p) => [v, p.payload.fullName]} />
              <Bar dataKey="count" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Eligible Employees by Issuance Month">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={eligibleByMonth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--success))" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Headcount vs Eligibility Trend">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={headcountTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line dataKey="totalHeadcount" stroke="hsl(var(--primary))" />
              <Line dataKey="eligibleEmployees" stroke="hsl(var(--success))" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Eligible Employees by Gender">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={eligibleByGender} dataKey="value" innerRadius={60} outerRadius={100}>
                {eligibleByGender.map((g, i) => (
                  <Cell key={i} fill={g.fill} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <DataTable
        data={tableData}
        columns={[
          { key: 'department', header: 'Department' },
          { key: 'totalHeadcount', header: 'Total Headcount', className: 'text-right' },
          { key: 'activeHeadcount', header: 'Active Headcount', className: 'text-right' },
          { key: 'eligibleHeadcount', header: 'Eligible Headcount', className: 'text-right' },
          {
            key: 'eligibilityPercentage',
            header: 'Eligibility %',
            className: 'text-right',
            render: (item: EligibleEmployeeSummary) => (
              <span className={item.eligibilityPercentage >= 70 ? 'text-success font-medium' : ''}>
                {item.eligibilityPercentage}%
              </span>
            ),
          },
        ]}
        title="Eligible Employees Details"
      />
    </div>
  );
}
