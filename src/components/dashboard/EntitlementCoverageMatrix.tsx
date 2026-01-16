import { useState } from "react";
import { Search } from "lucide-react";

type MatrixRow = {
  sku: string;
  Administration?: number;
  IT?: number;
  Logistics?: number;
  Maintenance?: number;
  Production?: number;
  "Quality Control"?: number;
  Security?: number;
  Warehouse?: number;
};

const MOCK_MATRIX_DATA: MatrixRow[] = [
  {
    sku: "Safety Boots",
    Administration: 18,
    IT: 36,
    Logistics: 20,
    Maintenance: 39,
    Production: 21,
    Security: 19,
    Warehouse: 19,
  },
  {
    sku: "Hard Hat",
    Administration: 22,
    IT: 35,
    Logistics: 27,
    Maintenance: 37,
    Production: 35,
    "Quality Control": 9,
    Security: 7,
  },
  {
    sku: "Coveralls",
    Administration: 25,
    Maintenance: 11,
    Production: 50,
    "Quality Control": 25,
  },
  {
    sku: "Safety Gloves",
    Administration: 42,
    IT: 41,
    Logistics: 36,
    Production: 16,
    "Quality Control": 22,
  },
  {
    sku: "Hi-Vis Vest",
    Administration: 46,
    IT: 15,
    Logistics: 6,
    Maintenance: 40,
  },
  {
    sku: "Safety Goggles",
    Maintenance: 22,
    Production: 24,
    "Quality Control": 25,
    Security: 23,
    Warehouse: 37,
  },
];

const DEPARTMENTS = [
  "Administration",
  "IT",
  "Logistics",
  "Maintenance",
  "Production",
  "Quality Control",
  "Security",
  "Warehouse",
];

export function EntitlementCoverageMatrix() {
  const [search, setSearch] = useState("");

  const filteredData = MOCK_MATRIX_DATA.filter((row) =>
    row.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="rounded-lg border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4">
        <h3 className="text-sm font-semibold">
          Entitlement Coverage Matrix
        </h3>

        <div className="relative w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Search SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-md border pl-8 pr-2 text-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="max-h-[420px] overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-muted">
            <tr>
              <th className="px-4 py-3 text-left font-medium">
                SKU Name
              </th>
              {DEPARTMENTS.map((dept) => (
                <th
                  key={dept}
                  className="px-4 py-3 text-center font-medium"
                >
                  {dept}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {filteredData.map((row) => (
              <tr
                key={row.sku}
                className="border-b last:border-none"
              >
                <td className="px-4 py-3 font-medium">
                  {row.sku}
                </td>

                {DEPARTMENTS.map((dept) => (
                  <td
                    key={dept}
                    className="px-4 py-3 text-center"
                  >
                    {row[dept as keyof MatrixRow] !== undefined ? (
                      <span className="inline-flex min-w-[32px] justify-center rounded bg-muted px-2 py-1">
                        {row[dept as keyof MatrixRow]}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}

            {filteredData.length === 0 && (
              <tr>
                <td
                  colSpan={DEPARTMENTS.length + 1}
                  className="p-6 text-center text-muted-foreground"
                >
                  No SKUs found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
