import { useMemo, useState } from "react";
import { FilterPanel } from "./FilterPanel";
import { DataTable } from "./DataTable";
import { demandForecastData } from "../../data/demandForecastData";

/* =====================
   TYPES
===================== */
interface DemandRow {
  sku: string;
  frequencyMonths: number;
  AOC: number;
  inflight: number;
  cargo: number;
  engineering: number;
  qty: number;
  total: number;
}

export default function DemandForecastTab() {
  /* =====================
     FILTER STATES
     (UI only – backend-ready)
  ====================== */
  const [month, setMonth] = useState("all");
  const [year, setYear] = useState("2025");

  const filters = [
    {
      id: "month",
      label: "Month",
      value: month,
      onChange: setMonth,
      options: [
        { value: "all", label: "All Months" },
        { value: "Jan", label: "January" },
        { value: "Feb", label: "February" },
      ],
    },
    {
      id: "year",
      label: "Year",
      value: year,
      onChange: setYear,
      options: [
        { value: "2025", label: "2025" },
        { value: "2026", label: "2026" },
      ],
    },
  ];

  const handleReset = () => {
    setMonth("all");
    setYear("2025");
  };

  /* =====================
     TRANSFORM DATA (NO MONTH FILTER YET)
  ====================== */
  const tableData: DemandRow[] = useMemo(() => {
    const skuMap = new Map<string, DemandRow>();

    demandForecastData.forEach((item) => {
      if (!skuMap.has(item.sku)) {
        skuMap.set(item.sku, {
          sku: item.sku,
          frequencyMonths: item.frequencyMonths,
          AOC: 0,
          inflight: 0,
          cargo: 0,
          engineering: 0,
          qty: 0,
          total: 0,
        });
      }

      const row = skuMap.get(item.sku)!;

      if (item.department === "AOCS") row.AOC += item.quantity;
      if (item.department === "Inflights") row.inflight += item.quantity;
      if (item.department === "Cargo") row.cargo += item.quantity;
      if (item.department === "Engineering") row.engineering += item.quantity;

      row.qty =
        row.AOC + row.inflight + row.cargo + row.engineering;

      row.total = row.qty;
    });

    return Array.from(skuMap.values());
  }, []);

  /* =====================
     UI
  ====================== */
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Demand Forecast</h2>
        <p className="text-sm text-muted-foreground">
          SKU-wise uniform demand forecast by department
        </p>
      </div>

      <FilterPanel filters={filters} onReset={handleReset} />

      <DataTable
        title="Demand Forecast Table"
        data={tableData}
        columns={[
          { key: "sku", header: "SKU Name" },
          {
            key: "frequencyMonths",
            header: "Frequency (Months)",
            className: "text-right",
          },
          { key: "AOC", header: "AOC", className: "text-right" },
          {
            key: "inflight",
            header: "Inflight Services",
            className: "text-right",
          },
          { key: "cargo", header: "Cargo", className: "text-right" },
          {
            key: "engineering",
            header: "Engineering",
            className: "text-right",
          },
          { key: "qty", header: "Qty", className: "text-right" },
          {
            key: "total",
            header: "Total",
            className: "text-right font-semibold",
          },
        ]}
      />
    </div>
  );
}
