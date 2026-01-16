import { useState } from "react";
import { KPICard } from "./KPICard";
import { FilterPanel } from "./FilterPanel";
import { ChartCard } from "./ChartCard";
import { AnalyticsChartCard } from "@/components/dashboard/AnalyticsChartCard";
import { EntitlementCoverageMatrix } from "@/components/dashboard/EntitlementCoverageMatrix";

export default function UniformEntitlementCoverageTab() {
  /* =====================
     FILTER STATES
  ====================== */
  const [department, setDepartment] = useState<string[]>([]);
  const [location, setLocation] = useState<string[]>([]);
  const [gender, setGender] = useState<string[]>([]);
  const [sku, setSku] = useState<string[]>([]);
  const [frequency, setFrequency] = useState<string[]>([]);


  /* =====================
     FILTER CONFIG
  ====================== */
 const filters = [
  {
    id: "department",
    label: "Department",
    value: department,
    onChange: setDepartment,
    multi: true, // ✅ REQUIRED
    options: [
      { value: "AOCS", label: "AOCS" },
      { value: "Cargo", label: "Cargo" },
      { value: "Engineering", label: "Engineering" },
      { value: "Inflights", label: "Inflights" },
      
    ],
   },

  {
    id: "gender",
    label: "Gender",
    value: gender,
    onChange: setGender,
    multi: true,
    options: [
      { value: "all", label: "All" },
      { value: "male", label: "Male" },
      { value: "female", label: "Female" },
      { value: "Both", label: "Both" },
    ],
  },
  {
    id: "location",
    label: "Location",
    value: location,
    onChange: setLocation,
    multi: true,
    options: [
      { value: "all", label: "All" },
      { value: "chennai", label: "Chennai" },
      { value: "pune", label: "Pune" },
      { value: "bangalore", label: "Bangalore" },
      { value: "hyderabad", label: "Hyderabad" },
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
      { value: "safety-boots", label: "Safety Boots" },
      { value: "helmet", label: "Helmet" },
      { value: "gloves", label: "Safety Gloves" },
      { value: "jacket", label: "Jacket" },
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
      { value: "0", label: "0 Months" },
      { value: "6", label: "6 Months" },
      { value: "12", label: "12 Months" },
      { value: "18", label: "18 Months" },
      { value: "24", label: "24 Months" },
      { value: "36", label: "36 Months" },
    ],
  },
];

const handleReset = () => {
  setDepartment([]);
  setGender([]);
  setLocation([]);
  setSku([]);
  setFrequency([]);
};

  /* =====================
     KPI DATA (backend-ready)
  ====================== */
  const kpiData = {
    totalEligibleDepartments: 8,
    totalUniqueSkus: 18,
  };

  /* =====================
     CHART DATA (backend-ready)
  ====================== */
  const skusByDepartment = [
    { name: "Production", value: 15 },
    { name: "Maintenance", value: 14 },
    { name: "Administration", value: 13 },
    { name: "Security", value: 12 },
    { name: "Quality Control", value: 12 },
    { name: "Logistics", value: 11 },
    { name: "IT", value: 10 },
    { name: "Warehouse", value: 9 },
  ];

  const skusByGender = [
    { name: "Male", value: 18 },
    { name: "Female", value: 18 },
    { name: "Others", value: 18 },
  ];

  const skusByLocation = [
    { name: "Chennai", value: 18 },
    { name: "Pune", value: 18 },
    { name: "Mumbai", value: 18 },
    { name: "Delhi", value: 18 },
    { name: "Bangalore", value: 18 },
    { name: "Hyderabad", value: 18 },
  ];

  const skusByFrequency = [
    { name: "6 months", value: 18 },
    { name: "12 months", value: 17 },
    { name: "18 months", value: 18 },
    { name: "24 months", value: 18 },
  ];

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
          value={kpiData.totalEligibleDepartments}
        />
        <KPICard
          title="Total Unique SKUs"
          value={kpiData.totalUniqueSkus}
        />
      </div>

      
      {/* Coverage Analysis */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Unique SKUs by Department">
         <AnalyticsChartCard
          type="bar"
          data={[
            { name: "Production", value: 15 },
            { name: "Maintenance", value: 14 },
            { name: "Administration", value: 13 },
            { name: "Security", value: 12 },
            { name: "Quality Control", value: 12 },
            { name: "Logistics", value: 11 },
            { name: "IT", value: 10 },
            { name: "Warehouse", value: 9 },
             ]}
          />
       </ChartCard>

       <ChartCard title="Unique SKUs by Gender">
         <AnalyticsChartCard
          type="bar"
          data={[
            { name: "Male", value: 18 },
            { name: "Female", value: 18 },
            { name: "Others", value: 18 },
            ]}
         />
       </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
       <ChartCard title="Unique SKUs by Location">
         <AnalyticsChartCard
          type="bar"
          data={[
            { name: "Chennai", value: 18 },
            { name: "Pune", value: 18 },
            { name: "Mumbai", value: 18 },
            { name: "Delhi", value: 18 },
            { name: "Bangalore", value: 18 },
            { name: "Hyderabad", value: 18 },
            ]}
         />
       </ChartCard>

       <ChartCard title="Unique SKUs by Frequency">
         <AnalyticsChartCard
          type="bar"
          data={[
            { name: "6 months", value: 18 },
            { name: "12 months", value: 17 },
            { name: "18 months", value: 18 },
            { name: "24 months", value: 18 },
            ]}
         />
       </ChartCard>
      </div>


      {/* Entitlement Coverage Matrix */}
      <ChartCard title="Entitlement Coverage Matrix">
        <EntitlementCoverageMatrix />
      </ChartCard>

    </div>
  );
}
