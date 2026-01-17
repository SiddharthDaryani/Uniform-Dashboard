import { useState, useMemo } from 'react';
import { Users, UserCheck, Percent, Building2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query'; // ✅ IMPORT
import { fetchDashboardData } from '@/lib/api'; // ✅ IMPORT
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
  // ✅ SINGLE-SELECT DEPARTMENT
  const [deptFilter, setDeptFilter] = useState('All');

  // ✅ SINGLE-SELECT LOCATION
  const [locationFilter, setLocationFilter] = useState('All');

  const [genderFilter, setGenderFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');

  // ================= QUERY CONSTRUCTION =================
  const constructQuery = (baseMetric: string) => {
    let query = baseMetric;
    if (deptFilter !== 'All') query += ` in ${deptFilter} department`;
    if (locationFilter !== 'All') query += ` in ${locationFilter}`;
    if (genderFilter !== 'all') query += ` and gender ${genderFilter}`;
    if (monthFilter !== 'all') query += ` for month ${monthFilter}`;
    return query;
  };

  // ================= API QUERIES =================
  // ================= API QUERIES =================
  const { data: totalEmployeesData, isLoading: isLoadingTotal } = useQuery({
    queryKey: ['totalEmployees_elig', deptFilter, locationFilter, genderFilter, monthFilter],
    queryFn: () => fetchDashboardData(constructQuery('total number of employees')),
  });

  const { data: eligibleEmployeesData, isLoading: isLoadingEligible } = useQuery({
    queryKey: ['eligibleEmployees', deptFilter, locationFilter, genderFilter, monthFilter],
    queryFn: () => fetchDashboardData(constructQuery('total number of eligible employees')),
  });

  const { data: eligibleDeptsData, isLoading: isLoadingEligDepts } = useQuery({
    queryKey: ['eligibleDepts', deptFilter, locationFilter],
    queryFn: () => fetchDashboardData('total number of eligible departments'),
  });

  // Charts
  const { data: eligibleByDeptData } = useQuery({
    queryKey: ['eligibleByDept', deptFilter, locationFilter, genderFilter, monthFilter],
    queryFn: () => fetchDashboardData(constructQuery('eligible employees breakdown by department')),
  });

  const { data: eligibleByGenderData } = useQuery({
    queryKey: ['eligibleByGender', deptFilter, locationFilter, genderFilter, monthFilter],
    queryFn: () => fetchDashboardData(constructQuery('eligible employees breakdown by gender')),
  });

  const { data: eligibleByMonthData } = useQuery({
    queryKey: ['eligibleByMonth', deptFilter, locationFilter, genderFilter, monthFilter],
    queryFn: () => fetchDashboardData(constructQuery('eligible employees breakdown by issuance month')),
  });


  const { data: eligibleTrendData } = useQuery({
    queryKey: ['eligibleTrend', deptFilter, locationFilter, genderFilter],
    queryFn: () => fetchDashboardData(constructQuery('headcount vs eligible trend')),
  });

  // Table
  const { data: eligibleSummaryData } = useQuery({
    queryKey: ['eligibleSummary', deptFilter, locationFilter, genderFilter, monthFilter],
    queryFn: () => fetchDashboardData(constructQuery('eligible employee summary')),
  });


  // ================= DATA PROCESSING =================
  // KPIs
  const totalEmployees = totalEmployeesData?.data?.[0]?.value || 0;
  const eligibleEmployees = eligibleEmployeesData?.data?.[0]?.value || 0;
  const eligibleDepartmentsCount = eligibleDeptsData?.data?.[0]?.value || 0;

  const eligibilityRate =
    totalEmployees > 0
      ? Math.round((eligibleEmployees / totalEmployees) * 100)
      : 0;

  // Charts
  const eligibleByDept = eligibleByDeptData?.data?.map((item: any) => {
    // Determine if this item is eligible based on explicit status or absence of 'Ineligible' status
    const isExplicitlyIneligible = item.eligibility_status === 'Ineligible' || item.isEligible === false;
    const isEligible = !isExplicitlyIneligible;

    let count = 0;
    if (isEligible) {
      // Prioritize explicit counts (value, count, eligible_employees) over headcount if both exist
      count = item.value || item.count || item.eligible_employees || item.total_employees || item.active_employees || item.eligible || 0;
    }

    return {
      department: item.department ? (item.department.length > 10 ? item.department.slice(0, 10) + '...' : item.department) : item.name,
      fullName: item.department || item.name,
      count: count,
    };
  }).filter((item: any) => item.count > 0) || [];


  const eligibleByMonth = eligibleByMonthData?.data?.map((item: any) => ({
    month: item.month ? item.month.split(' ')[0] : (item.issuanceMonth || item.name || item.department || 'Total'),
    count: item.eligible_employees || item.value || item.count || 0,
  })) || [];


  const eligibleByGender = eligibleByGenderData?.data?.map((item: any, i: number) => ({
    name: item.gender || item.name,
    value: item.value || item.count || 0,
    fill: COLORS[i % COLORS.length],
  })) || [];


  const headcountTrend = eligibleTrendData?.data?.map((item: any) => ({
    month: item.month ? (item.month.includes('-') ? item.month : item.month.split(' ')[0]) : item.name,
    totalHeadcount: item.total_headcount || item.totalHeadcount || item.total || 0,
    eligibleEmployees: item.eligible_headcount || item.eligible_employees || item.eligibleEmployees || item.eligible || 0,
  })) || [];

  // Table
  const tableData: EligibleEmployeeSummary[] = useMemo(() => {
    if (!eligibleSummaryData?.data) return [];

    // Case 1: Data is a list of status labels (Active/Inactive) for a filtered selection
    const firstItem = eligibleSummaryData.data[0];
    if (firstItem && (firstItem.label !== undefined || firstItem.status !== undefined)) {
      const active = eligibleSummaryData.data.find((i: any) => i.label === 'Active' || i.status === 'Active')?.value || 0;
      const inactive = eligibleSummaryData.data.find((i: any) => i.label === 'Inactive' || i.status === 'Inactive')?.value || 0;
      const unknowns = eligibleSummaryData.data.find((i: any) => i.label === null || i.label === 'None')?.value || 0;
      const eligible = eligibleSummaryData.data.find((i: any) => i.label === 'Eligible' || i.status === 'Eligible')?.value || active;
      const total = active + inactive + unknowns;

      return [{
        department: deptFilter !== 'All' ? deptFilter : (locationFilter !== 'All' ? locationFilter : 'Filtered Results'),
        totalHeadcount: total,
        activeHeadcount: active,
        eligibleHeadcount: eligible,
        eligibilityPercentage: (total > 0) ? Math.round((eligible / total) * 100) : 0,
      }];
    }

    return eligibleSummaryData.data.map((item: any) => {
      const total = item.total_employees || item.totalHeadcount || item.total || 0;
      const active = item.active_employees || item.activeHeadcount || item.active || 0;
      const isEligible = item.eligibility_status === 'Eligible' || item.isEligible === true;
      const eligible = item.eligible_employees || item.eligibleHeadcount || item.eligible || (isEligible ? total : 0);

      return {
        department: item.department || item.name || 'Unknown',
        totalHeadcount: total,
        activeHeadcount: active,
        eligibleHeadcount: eligible,
        eligibilityPercentage: item.eligibility_percentage || item.eligibilityPercentage || (total > 0 ? Math.round((eligible / total) * 100) : 0),
      };
    });
  }, [eligibleSummaryData, deptFilter, locationFilter]);

  // ================= FILTER CONFIG =================
  const filters = [
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
    setDeptFilter('All');
    setLocationFilter('All');
    setGenderFilter('all');
    setMonthFilter('all');
  };

  // ================= UI =================
  return (
    <div className="space-y-6">
      <FilterPanel filters={filters} onReset={resetFilters} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Employees"
          value={isLoadingTotal ? '...' : totalEmployees}
          icon={Users}
        />
        <KPICard
          title="Eligible Employees"
          value={isLoadingEligible ? '...' : eligibleEmployees}
          icon={UserCheck}
          variant="success"
        />
        <KPICard
          title="Eligibility Rate"
          value={isLoadingTotal || isLoadingEligible ? '...' : `${eligibilityRate}%`}
          icon={Percent}
        />
        <KPICard
          title="Eligible Departments"
          value={isLoadingEligDepts ? '...' : eligibleDepartmentsCount}
          icon={Building2}
        />
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
