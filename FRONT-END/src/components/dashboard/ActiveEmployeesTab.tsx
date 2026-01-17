import { useState, useMemo } from 'react';
import { Users, UserCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query'; // ✅ IMPORT
import { fetchDashboardData } from '@/lib/api'; // ✅ IMPORT
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

  departments,
  locations,
  genders,
  statuses,
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

  // ✅ SINGLE-SELECT FILTERS
  const [deptFilter, setDeptFilter] = useState('All');
  const [locationFilter, setLocationFilter] = useState('All');

  const [genderFilter, setGenderFilter] = useState('all');

  // ================= QUERY CONSTRUCTION =================
  const constructQuery = (baseMetric: string) => {
    let query = baseMetric;
    if (deptFilter !== 'All') query += ` in ${deptFilter} department`;
    if (locationFilter !== 'All') query += ` in ${locationFilter}`;
    if (statusFilter !== 'all') query += ` with status ${statusFilter}`;
    if (genderFilter !== 'all') query += ` and gender ${genderFilter}`;
    return query;
  };

  // ================= API QUERIES =================
  const { data: totalEmployeesData, isLoading: isLoadingTotal } = useQuery({
    queryKey: ['totalEmployees', deptFilter, locationFilter, statusFilter, genderFilter],
    queryFn: () => fetchDashboardData(constructQuery('total number of employees')),
  });

  const { data: activeEmployeesData, isLoading: isLoadingActive } = useQuery({
    queryKey: ['activeEmployees', deptFilter, locationFilter, genderFilter],
    queryFn: () => fetchDashboardData(constructQuery('total number of active employees')),
  });

  // Charts
  const { data: statusDistData } = useQuery({
    queryKey: ['statusDist', deptFilter, locationFilter, genderFilter],
    queryFn: () => fetchDashboardData(constructQuery('total employees breakdown by status')),
  });

  const { data: activeByDeptData } = useQuery({
    queryKey: ['activeByDept', deptFilter, locationFilter, genderFilter],
    queryFn: () => fetchDashboardData(constructQuery('active employees breakdown by department')),
  });

  const { data: activeByGenderData } = useQuery({
    queryKey: ['activeByGender', deptFilter, locationFilter, genderFilter],
    queryFn: () => fetchDashboardData(constructQuery('active employees breakdown by gender')),
  });

  const { data: eligibleByMonthData } = useQuery({
    queryKey: ['eligibleByMonth', deptFilter, locationFilter, genderFilter],
    queryFn: () => fetchDashboardData(constructQuery('eligible employees breakdown by issuance month')),
  });

  // Table
  const { data: deptSummaryData } = useQuery({
    queryKey: ['deptSummary', deptFilter, locationFilter, genderFilter],
    queryFn: () => fetchDashboardData(constructQuery('department summary')),
  });


  // ================= DATA PROCESSING =================
  // Extract KPIs
  const totalEmployees = totalEmployeesData?.data?.[0]?.value || 0;
  const activeEmployees = activeEmployeesData?.data?.[0]?.value || 0;

  // Process Chart Data
  // Fix for Status Distribution:
  // If the backend returns a list of departments with active/inactive counts instead of a status summary,
  // we must aggregate it ourselves.
  const statusDistribution = useMemo(() => {
    if (!statusDistData?.data) return [];

    // Check if the response is trying to be "per department" (has departments)
    // or if it's already a status list (has status/name).
    const isDeptList = statusDistData.data[0]?.department;

    if (isDeptList) {
      // Aggregate Active/Inactive from department list
      const totalActive = statusDistData.data.reduce((sum: number, item: any) => sum + (item.active_employees || 0), 0);
      const totalInactive = statusDistData.data.reduce((sum: number, item: any) => sum + (item.inactive_employees || 0), 0);
      return [
        { name: 'Active', value: totalActive },
        { name: 'Inactive', value: totalInactive },
      ];
    }

    // Otherwise assume it's a direct status list
    return statusDistData.data.map((item: any) => ({
      name: item.label === null ? "None" : (item.label || item.status || item.name),
      value: item.value || item.count || 0,
    }));
  }, [statusDistData]);


  const activeByDept = activeByDeptData?.data?.map((item: any) => ({
    name: item.department ? (item.department.length > 10 ? item.department.slice(0, 10) + '...' : item.department) : item.name,
    fullName: item.department || item.name,
    // Backend returns 'active_employees' for 'active breakdown'
    value: item.active_employees || item.value || item.count || 0,
  })) || [];

  const activeByGender = activeByGenderData?.data?.map((item: any) => ({
    name: item.gender || item.name,
    // Backend might return snake_case or different keys (active_employees, inactive_employees, etc.)
    count: item.value || item.count || item.active_employees || item.inactive_employees || 0,
  })) || [];

  const eligibleByMonth = eligibleByMonthData?.data?.map((item: any) => ({
    month: item.issuanceMonth || item.month || item.name || item.department || 'Total',
    count: item.eligible_employees || item.active_employees || item.value || item.count || 0,
  })) || [];

  // Process Table Data
  const departmentSummary: DepartmentSummary[] = useMemo(() => {
    if (!deptSummaryData?.data) return [];

    // Case 1: Data is a list of status labels (Active/Inactive) for a filtered selection
    const firstItem = deptSummaryData.data[0];
    if (firstItem && firstItem.label && firstItem.value !== undefined) {
      const active = deptSummaryData.data.find((i: any) => i.label === 'Active')?.value || 0;
      const inactive = deptSummaryData.data.find((i: any) => i.label === 'Inactive')?.value || 0;
      const total = active + inactive;

      return [{
        department: deptFilter !== 'All' ? deptFilter : (locationFilter !== 'All' ? locationFilter : 'Filtered Results'),
        totalEmployees: total,
        activeEmployees: active,
        inactiveEmployees: inactive,
        activePercentage: total ? Math.round((active / total) * 100) : 0,
        locationsPresent: locationFilter !== 'All' ? 1 : 0,
      }];
    }

    // Case 2: Standard department list
    return deptSummaryData.data.map((item: any) => {
      const total = item.total_employees || item.totalEmployees || item.total || 0;
      const active = item.active_employees || item.activeEmployees || item.active || 0;
      const inactive = (item.inactive_employees !== undefined && item.inactive_employees !== null)
        ? item.inactive_employees
        : (total - active);

      return {
        department: item.department || item.name || 'Unknown',
        totalEmployees: total,
        activeEmployees: active,
        inactiveEmployees: inactive,
        activePercentage: item.active_percentage || item.activePercentage ||
          (total ? Math.round((active / total) * 100) : 0),
        locationsPresent: item.number_of_locations_present || item.locationsPresent || item.locations || 1,
      };
    });
  }, [deptSummaryData, deptFilter, locationFilter]);


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
      options: [
        { value: 'All', label: 'All' },
        ...departments.map((d) => ({ value: d, label: d })),
      ],
      value: deptFilter,
      onChange: setDeptFilter,
    },
    {
      id: 'location',
      label: 'Location',
      options: [
        { value: 'All', label: 'All' },
        ...locations.map((l) => ({ value: l, label: l })),
      ],
      value: locationFilter,
      onChange: setLocationFilter,
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
  ];

  const resetFilters = () => {
    setStatusFilter('all');
    setDeptFilter('All');
    setLocationFilter('All');
    setGenderFilter('all');
  };

  // ================= UI =================
  return (
    <div className="space-y-6">
      <FilterPanel filters={filters} onReset={resetFilters} />

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <KPICard
          title="Total Employees"
          value={isLoadingTotal ? '...' : totalEmployees}
          icon={Users}
        />
        <KPICard
          title="Active Employees"
          value={isLoadingActive ? '...' : activeEmployees}
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
                {statusDistribution.map((entry, index) => {
                  let color = COLORS[index % COLORS.length];
                  if (entry.name === 'Active') color = 'hsl(var(--success))'; // Green
                  if (entry.name === 'Inactive') color = 'hsl(var(--destructive))'; // Red
                  if (entry.name === 'None') color = 'hsl(var(--muted))'; // Grey

                  return <Cell key={`cell-${index}`} fill={color} />;
                })}
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

      {/* ✅ CHARTS ROW 2 */}
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
