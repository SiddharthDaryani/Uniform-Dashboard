import { useState, useMemo } from 'react';
import { Users, UserCheck } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
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
import { FilterPanel } from './FilterPanel';
import { ChartCard } from './ChartCard';
import { DataTable } from './DataTable';

import {
  employees,
  departments,
  locations,
  genders,
  statuses,
  months,
  DepartmentSummary,
} from '@/data/mockData';

const COLORS = [
  'hsl(142, 76%, 36%)',
  'hsl(215, 16%, 47%)',
  'hsl(217, 91%, 60%)',
  'hsl(38, 92%, 50%)',
  'hsl(262, 83%, 58%)',
  'hsl(173, 80%, 40%)',
];

export function ActiveEmployeesTab() {
  const [statusFilter, setStatusFilter] = useState('all');

  // ✅ MULTI-SELECT CHECKBOX FILTERS
  const [deptFilter, setDeptFilter] = useState<string[]>([]);
  const [locationFilter, setLocationFilter] = useState<string[]>([]);

  const [genderFilter, setGenderFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');

  // ================= FILTERED DATA =================
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (statusFilter !== 'all' && emp.status !== statusFilter) return false;
      if (deptFilter.length > 0 && !deptFilter.includes(emp.department))
        return false;
      if (locationFilter.length > 0 && !locationFilter.includes(emp.location))
        return false;
      if (genderFilter !== 'all' && emp.gender !== genderFilter) return false;
      if (monthFilter !== 'all' && emp.issuanceMonth !== monthFilter)
        return false;
      return true;
    });
  }, [statusFilter, deptFilter, locationFilter, genderFilter, monthFilter]);

  // ================= KPI VALUES =================
  const totalEmployees = filteredEmployees.length;
  const activeEmployees = filteredEmployees.filter(
    (e) => e.status === 'Active'
  ).length;

  // ================= CHART DATA =================
  const statusDistribution = useMemo(() => {
    const active = filteredEmployees.filter(
      (e) => e.status === 'Active'
    ).length;
    return [
      { name: 'Active', value: active },
      { name: 'Inactive', value: filteredEmployees.length - active },
    ];
  }, [filteredEmployees]);

  const activeByDept = useMemo(() => {
    return departments.map((dept) => ({
      name: dept.length > 10 ? dept.slice(0, 10) + '...' : dept,
      fullName: dept,
      value: filteredEmployees.filter(
        (e) => e.department === dept && e.status === 'Active'
      ).length,
    }));
  }, [filteredEmployees]);

  const activeByGender = useMemo(() => {
    return genders.map((gender) => ({
      name: gender,
      count: filteredEmployees.filter(
        (e) => e.gender === gender && e.status === 'Active'
      ).length,
    }));
  }, [filteredEmployees]);

  const eligibleByMonth = useMemo(() => {
    return months.map((month) => ({
      month: month.split(' ')[0],
      count: filteredEmployees.filter(
        (e) => e.issuanceMonth === month && e.isEligible
      ).length,
    }));
  }, [filteredEmployees]);

  // ================= TABLE =================
  const departmentSummary: DepartmentSummary[] = useMemo(() => {
    return departments
      .map((dept) => {
        const deptEmployees = filteredEmployees.filter(
          (e) => e.department === dept
        );
        const activeCount = deptEmployees.filter(
          (e) => e.status === 'Active'
        ).length;
        const uniqueLocations = new Set(
          deptEmployees.map((e) => e.location)
        ).size;

        return {
          department: dept,
          totalEmployees: deptEmployees.length,
          activeEmployees: activeCount,
          inactiveEmployees: deptEmployees.length - activeCount,
          activePercentage:
            deptEmployees.length > 0
              ? Math.round((activeCount / deptEmployees.length) * 100)
              : 0,
          locationsPresent: uniqueLocations,
        };
      })
      .filter((d) => d.totalEmployees > 0);
  }, [filteredEmployees]);

  // ================= FILTER CONFIG =================
  const filters = [
    {
      id: 'status',
      label: 'Employee Status',
      options: [
        { value: 'all', label: 'All Statuses' },
        ...statuses.map((s) => ({ value: s, label: s })),
      ],
      value: statusFilter,
      onChange: setStatusFilter,
    },
    {
      id: 'department',
      label: 'Department',
      options: departments.map((d) => ({ value: d, label: d })),
      value: deptFilter,
      onChange: setDeptFilter,
      multi: true,
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
    setStatusFilter('all');
    setDeptFilter([]);
    setLocationFilter([]);
    setGenderFilter('all');
    setMonthFilter('all');
  };

  // ================= UI =================
  return (
    <div className="space-y-6">
      <FilterPanel filters={filters} onReset={resetFilters} />

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <KPICard title="Total Employees" value={totalEmployees} icon={Users} />
        <KPICard
          title="Active Employees"
          value={activeEmployees}
          icon={UserCheck}
          variant="success"
        />
      </div>

      {/* CHARTS ROW 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Employee Status Distribution">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={statusDistribution} innerRadius={60} outerRadius={100} dataKey="value">
                {statusDistribution.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Active Employees by Department">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={activeByDept} outerRadius={100} dataKey="value">
                {activeByDept.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ✅ CHARTS ROW 2 (RESTORED) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Eligible Employee Count by Issuance Month">
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

        <ChartCard title="Active Employees by Gender">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={activeByGender}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* TABLE */}
      <DataTable
        data={departmentSummary}
        columns={[
          { key: 'department', header: 'Department' },
          { key: 'totalEmployees', header: 'Total Employees', className: 'text-right' },
          { key: 'activeEmployees', header: 'Active Employees', className: 'text-right' },
          { key: 'inactiveEmployees', header: 'Inactive Employees', className: 'text-right' },
          { key: 'activePercentage', header: '% Active', className: 'text-right' },
          { key: 'locationsPresent', header: 'Locations', className: 'text-right' },
        ]}
        title="Detailed Active Employees"
      />
    </div>
  );
}
