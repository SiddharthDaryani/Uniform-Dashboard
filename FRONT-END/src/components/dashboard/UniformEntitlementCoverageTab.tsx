import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query"; // ✅ IMPORT
import { fetchDashboardData } from "@/lib/api"; // ✅ IMPORT
import { KPICard } from "./KPICard";
import { FilterPanel } from "./FilterPanel";
import { ChartCard } from "./ChartCard";
import { AnalyticsChartCard } from "@/components/dashboard/AnalyticsChartCard";
import { EntitlementCoverageMatrix } from "@/components/dashboard/EntitlementCoverageMatrix";
import { departments, locations } from "@/data/mockData";

const LOCATION_MAP: Record<string, string> = {
  'AGR': 'Agra',
  'BBI': 'Bhubaneswar',
  'BHO': 'Bhopal',
  'DHM': 'Dharamshala (Kangra)',
  'IXL': 'Leh (Kushok Bakula Rimpoche Airport)',
  'SXR': 'Srinagar',
  'ALL': 'All Locations / Universal',
};

export default function UniformEntitlementCoverageTab() {
  /* =====================
     FILTER STATES
  ====================== */
  const [department, setDepartment] = useState('All');
  const [location, setLocation] = useState('All');
  const [gender, setGender] = useState('all');
  const [sku, setSku] = useState<string[]>([]);
  const [frequency, setFrequency] = useState<string[]>([]);


  /* =====================
     API QUERIES
  ====================== */
  // Consolidate into a single master query for speed and consistency
  const { data: masterData, isLoading } = useQuery({
    queryKey: ['entitlementMasterData'],
    queryFn: () => fetchDashboardData('all uniform entitlement details'),
  });

  /* =====================
     FILTER OPTIONS (DERIVED)
  ====================== */
  const eligibleDepartments = useMemo(() => {
    const depts = new Set<string>(masterData?.data?.map((i: any) => i.department).filter(Boolean));
    return Array.from(depts).sort();
  }, [masterData]);

  const availableSkus = useMemo(() => {
    const skus = new Set<string>(masterData?.data?.map((i: any) => i.sku || i.item).filter(Boolean));
    return Array.from(skus).sort();
  }, [masterData]);

  const availableLocations = useMemo(() => {
    const locs = new Set<string>();
    masterData?.data?.forEach((i: any) => {
      if (i.base_location) locs.add(i.base_location);
      if (i.location) locs.add(i.location);
    });
    return Array.from(locs).sort();
  }, [masterData]);

  const availableFrequencies = useMemo(() => {
    const freqs = new Set<string>(masterData?.data?.map((i: any) => String(i.frequency || i.issuance_frequency)).filter(Boolean));
    return Array.from(freqs).sort((a, b) => Number(a) - Number(b));
  }, [masterData]);

  /* =====================
     FILTER CONFIG
  ====================== */
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
        { value: "Both", label: "Both" },
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
      value: sku,
      onChange: setSku,
      multi: true,
      options: [
        { value: "all", label: "All SKUs" },
        ...availableSkus.map(s => ({ value: s, label: s }))
      ],
    },
    {
      id: "frequency",
      label: "Frequency",
      value: frequency,
      onChange: setFrequency,
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
    setSku([]);
    setFrequency([]);
  };

  /* =====================
     DATA PROCESSING
  ====================== */
  // 1. Filter the master data locally
  const filteredData = useMemo(() => {
    const rawList = masterData?.data || [];
    if (!Array.isArray(rawList)) return [];

    return rawList.filter((item: any) => {
      // Dept & Location (Single Select)
      if (department !== 'All' && item.department !== department) return false;
      if (location !== 'All' && (item.location !== location && item.base_location !== location)) return false;

      // Gender (Single Select Dropdown)
      if (gender !== 'all') {
        const itemGender = (item.gender || '').toLowerCase();
        if (itemGender !== gender.toLowerCase()) return false;
      }

      // SKU (Multi Select)
      if (sku.length > 0 && !sku.includes('all')) {
        const itemSku = item.sku || item.item;
        if (!sku.includes(itemSku)) return false;
      }

      // Frequency (Multi Select)
      if (frequency.length > 0 && !frequency.includes('all')) {
        const itemFreq = String(item.frequency || item.issuance_frequency);
        if (!frequency.includes(itemFreq)) return false;
      }

      return true;
    });
  }, [masterData, department, location, gender, sku, frequency]);

  // 2. Derive KPIs
  const totalUniqueSkus = useMemo(() => {
    const skus = new Set(filteredData.map(item => item.sku || item.item));
    return skus.size;
  }, [filteredData]);

  const totalEligibleDepartments = useMemo(() => {
    const depts = new Set(filteredData.map(item => item.department));
    return depts.size;
  }, [filteredData]);

  // 3. Derive Chart Data
  const skusByDepartment = useMemo(() => {
    const counts: Record<string, Set<string>> = {};
    filteredData.forEach(item => {
      const dept = item.department || 'Unknown';
      if (!counts[dept]) counts[dept] = new Set();
      counts[dept].add(item.sku || item.item);
    });
    return Object.entries(counts).map(([name, skuSet]) => ({
      name,
      value: skuSet.size
    }));
  }, [filteredData]);

  const skusByGender = useMemo(() => {
    const counts: Record<string, Set<string>> = {};
    filteredData.forEach(item => {
      const g = item.gender || 'Unknown';
      if (!counts[g]) counts[g] = new Set();
      counts[g].add(item.sku || item.item);
    });
    return Object.entries(counts).map(([name, skuSet]) => ({
      name,
      value: skuSet.size
    }));
  }, [filteredData]);

  const skusByLocation = useMemo(() => {
    const counts: Record<string, Set<string>> = {};
    filteredData.forEach(item => {
      const loc = item.base_location || item.location || 'Unknown';
      if (!counts[loc]) counts[loc] = new Set();
      counts[loc].add(item.sku || item.item);
    });
    return Object.entries(counts).map(([name, skuSet]) => ({
      name,
      value: skuSet.size
    }));
  }, [filteredData]);

  const skusByFrequency = useMemo(() => {
    const counts: Record<string, Set<string>> = {};
    filteredData.forEach(item => {
      const freq = item.frequency !== undefined ? String(item.frequency) : 'Unknown';
      if (!counts[freq]) counts[freq] = new Set();
      counts[freq].add(item.sku || item.item);
    });
    return Object.entries(counts).map(([name, skuSet]) => ({
      name,
      value: skuSet.size
    }));
  }, [filteredData]);

  // 4. Derive Matrix Data
  const matrixData = useMemo(() => {
    const matrix: Record<string, any> = {};
    filteredData.forEach(item => {
      const skuName = item.sku || item.item;
      const dept = item.department;
      if (!skuName || !dept) return;

      if (!matrix[skuName]) matrix[skuName] = { sku: skuName };
      matrix[skuName][dept] = (matrix[skuName][dept] || 0) + 1;
    });
    return Object.values(matrix);
  }, [filteredData]);


  /* =====================
     UI
  ====================== */
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold">Uniform Entitlement Coverage</h2>
        <p className="text-sm text-muted-foreground">
          Analyze and track uniform entitlements across departments, locations, and SKUs
        </p>
      </div>

      {/* Filters */}
      <FilterPanel title="Filters" filters={filters} onReset={handleReset} />

      {/* KPI Section */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KPICard
          title="Total Eligible Departments"
          value={isLoading ? '...' : totalEligibleDepartments}
        />
        <KPICard
          title="Total Unique SKUs"
          value={isLoading ? '...' : totalUniqueSkus}
        />
      </div>


      {/* Coverage Analysis */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Unique SKUs by Department">
          <AnalyticsChartCard
            type="bar"
            data={skusByDepartment}
          />
        </ChartCard>

        <ChartCard title="Unique SKUs by Gender">
          <AnalyticsChartCard
            type="bar"
            data={skusByGender}
          />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Unique SKUs by Location">
          <AnalyticsChartCard
            type="bar"
            data={skusByLocation}
          />
        </ChartCard>

        <ChartCard title="Unique SKUs by Frequency">
          <AnalyticsChartCard
            type="bar"
            data={skusByFrequency}
          />
        </ChartCard>
      </div>

      {/* Entitlement Coverage Matrix */}
      <ChartCard title="Entitlement Coverage Matrix">
        <EntitlementCoverageMatrix data={matrixData} isLoading={isLoading} />
      </ChartCard>

    </div>
  );
}
