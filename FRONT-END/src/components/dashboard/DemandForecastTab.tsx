import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchDashboardData } from "@/lib/api";
import { FilterPanel } from "./FilterPanel";
import { DataTable } from "./DataTable";
import { KPICard } from "./KPICard";
import { ChartCard } from "./ChartCard";
import { AnalyticsChartCard } from "./AnalyticsChartCard";

/* =====================
   CONSTANTS & TYPES
===================== */
const LOCATION_MAP: Record<string, string> = {
  'AGR': 'Agra',
  'BBI': 'Bhubaneswar',
  'BHO': 'Bhopal',
  'DHM': 'Dharamshala (Kangra)',
  'IXL': 'Leh (Kushok Bakula Rimpoche Airport)',
  'SXR': 'Srinagar',
  'ALL': 'All Locations / Universal',
};

interface ForecastRow {
  sku: string;
  frequency: number;
  gender: string;
  aocs: number;
  inflight: number;
  cargo: number;
  engineering: number;
  total: number;
}

export default function DemandForecastTab() {
  /* =====================
     FILTER STATES
  ====================== */
  const [department, setDepartment] = useState('All');
  const [location, setLocation] = useState('All');
  const [gender, setGender] = useState('all');
  const [skuFilter, setSkuFilter] = useState<string[]>([]);
  const [frequencyFilter, setFrequencyFilter] = useState<string[]>([]);

  /* =====================
     API QUERIES
  ====================== */
  const { data: masterData, isLoading } = useQuery({
    queryKey: ['demandMasterData'],
    queryFn: () => fetchDashboardData('total demand SKU'),
  });

  /* =====================
     FILTER OPTIONS (DERIVED)
  ====================== */
  const eligibleDepartments = useMemo(() => {
    const depts = new Set<string>(masterData?.data?.map((i: any) => i.department).filter(Boolean));
    return Array.from(depts).sort();
  }, [masterData]);

  const availableLocations = useMemo(() => {
    const locs = new Set<string>();
    masterData?.data?.forEach((i: any) => {
      if (i.base_location) locs.add(i.base_location);
    });
    return Array.from(locs).sort();
  }, [masterData]);

  const availableSkus = useMemo(() => {
    const skus = new Set<string>(masterData?.data?.map((i: any) => i.item_name).filter(Boolean));
    return Array.from(skus).sort();
  }, [masterData]);

  const availableFrequencies = useMemo(() => {
    const freqs = new Set<string>(masterData?.data?.map((i: any) => String(i.frequency)).filter(Boolean));
    return Array.from(freqs).sort((a, b) => Number(a) - Number(b));
  }, [masterData]);

  const filters = [
    {
      id: "department",
      label: "Department",
      value: department,
      onChange: setDepartment,
      options: [
        { value: "All", label: "All Departments" },
        ...eligibleDepartments.map(d => ({ value: d, label: d }))
      ],
    },
    {
      id: "gender",
      label: "Gender",
      value: gender,
      onChange: setGender,
      options: [
        { value: "all", label: "All Genders" },
        { value: "Male", label: "Male" },
        { value: "Female", label: "Female" },
        { value: "Both/Common", label: "Both/Common" },
      ],
    },
    {
      id: "location",
      label: "Location",
      value: location,
      onChange: setLocation,
      options: [
        { value: "All", label: "All Locations" },
        ...availableLocations.map(l => ({
          value: l,
          label: LOCATION_MAP[l] || l
        }))
      ],
    },
    {
      id: "sku",
      label: "SKU / Item",
      value: skuFilter,
      onChange: setSkuFilter,
      multi: true,
      options: [
        { value: "all", label: "All SKUs" },
        ...availableSkus.map(s => ({ value: s, label: s }))
      ],
    },
    {
      id: "frequency",
      label: "Frequency",
      value: frequencyFilter,
      onChange: setFrequencyFilter,
      multi: true,
      options: [
        { value: "all", label: "All Frequencies" },
        ...availableFrequencies.map(f => ({ value: f, label: `${f} Months` }))
      ],
    },
  ];

  const handleReset = () => {
    setDepartment('All');
    setGender('all');
    setLocation('All');
    setSkuFilter([]);
    setFrequencyFilter([]);
  };

  /* =====================
     DATA PROCESSING
  ====================== */
  const filteredData = useMemo(() => {
    const rawList = masterData?.data || [];
    if (!Array.isArray(rawList)) return [];

    return rawList.filter((item: any) => {
      if (department !== 'All' && item.department !== department) return false;
      if (location !== 'All' && item.base_location !== location) return false;
      if (gender !== 'all' && (item.sku_gender || '').toLowerCase() !== gender.toLowerCase()) return false;
      if (skuFilter.length > 0 && !skuFilter.includes('all') && !skuFilter.includes(item.item_name)) return false;
      if (frequencyFilter.length > 0 && !frequencyFilter.includes('all') && !frequencyFilter.includes(String(item.frequency))) return false;
      return true;
    });
  }, [masterData, department, location, gender, skuFilter, frequencyFilter]);

  // Derived KPIs
  const totalQuantityNeeded = useMemo(() => {
    return filteredData.reduce((sum, item) => sum + (item.total_quantity_needed || 0), 0);
  }, [filteredData]);

  const uniqueSkusCount = useMemo(() => {
    return new Set(filteredData.map(i => i.item_name)).size;
  }, [filteredData]);

  // Derived Charts
  const demandByDept = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.forEach(item => {
      const dept = item.department || 'Unknown';
      counts[dept] = (counts[dept] || 0) + (item.total_quantity_needed || 0);
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredData]);

  const demandByLocation = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.forEach(item => {
      const loc = LOCATION_MAP[item.base_location] || item.base_location || 'Unknown';
      counts[loc] = (counts[loc] || 0) + (item.total_quantity_needed || 0);
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredData]);

  const demandByGender = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.forEach(item => {
      const g = item.sku_gender || 'Unknown';
      counts[g] = (counts[g] || 0) + (item.total_quantity_needed || 0);
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredData]);

  const demandByFrequency = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.forEach(item => {
      const f = `${item.frequency || 0} Mo`;
      counts[f] = (counts[f] || 0) + (item.total_quantity_needed || 0);
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredData]);

  // Table Data
  const tableData: ForecastRow[] = useMemo(() => {
    const skuMap = new Map<string, ForecastRow>();

    filteredData.forEach((item: any) => {
      const key = item.item_name;
      if (!skuMap.has(key)) {
        skuMap.set(key, {
          sku: key,
          frequency: item.frequency,
          gender: item.sku_gender,
          aocs: 0,
          inflight: 0,
          cargo: 0,
          engineering: 0,
          total: 0,
        });
      }

      const row = skuMap.get(key)!;
      const dept = (item.department || '').toLowerCase();
      const qty = item.total_quantity_needed || 0;

      if (dept.includes('airport')) row.aocs += qty;
      else if (dept.includes('inflight')) row.inflight += qty;
      else if (dept.includes('cargo')) row.cargo += qty;
      else if (dept.includes('engg') || dept.includes('engineering')) row.engineering += qty;

      row.total = row.aocs + row.inflight + row.cargo + row.engineering;
    });

    return Array.from(skuMap.values()).sort((a, b) => b.total - a.total);
  }, [filteredData]);

  /* =====================
     UI
  ====================== */
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold">Demand Forecast (FY 2025-26)</h2>
        <p className="text-sm text-muted-foreground">
          Predictive uniform demand based on employee eligibility and issuance frequency
        </p>
      </div>

      {/* Filters */}
      <FilterPanel filters={filters} onReset={handleReset} />

      {/* KPI Section */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total Demand Quantity"
          value={isLoading ? '...' : totalQuantityNeeded.toLocaleString()}
        />
        <KPICard
          title="Unique SKUs"
          value={isLoading ? '...' : uniqueSkusCount}
        />
        <KPICard
          title="Total Occurrences"
          value={isLoading ? '...' : filteredData.reduce((s, i) => s + (i.total_occurrences || 0), 0).toLocaleString()}
        />
        <KPICard
          title="Filtered Departments"
          value={isLoading ? '...' : new Set(filteredData.map(i => i.department)).size}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Demand by Department">
          <AnalyticsChartCard type="bar" data={demandByDept} />
        </ChartCard>
        <ChartCard title="Demand by Gender">
          <AnalyticsChartCard type="bar" data={demandByGender} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Demand by Location">
          <AnalyticsChartCard type="bar" data={demandByLocation} />
        </ChartCard>
        <ChartCard title="Demand by Frequency">
          <AnalyticsChartCard type="bar" data={demandByFrequency} />
        </ChartCard>
      </div>

      {/* Detailed Table */}
      <DataTable
        title="Demand Forecast Table"
        data={tableData}
        isLoading={isLoading}
        columns={[
          { key: "sku", header: "SKU Name" },
          { key: "frequency", header: "Freq (Mo)", className: "text-right" },
          { key: "gender", header: "Gender" },
          { key: "aocs", header: "AOCS", className: "text-right", render: (row) => row.aocs.toLocaleString() },
          { key: "inflight", header: "Inflight", className: "text-right", render: (row) => row.inflight.toLocaleString() },
          { key: "cargo", header: "Cargo", className: "text-right", render: (row) => row.cargo.toLocaleString() },
          { key: "engineering", header: "Engg", className: "text-right", render: (row) => row.engineering.toLocaleString() },
          { key: "total", header: "Total Qty", className: "text-right font-semibold", render: (row) => row.total.toLocaleString() },
        ]}
      />
    </div>
  );
}
