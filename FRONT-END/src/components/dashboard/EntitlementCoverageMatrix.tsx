import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchDashboardData } from "@/lib/api";
import { departments } from "@/data/mockData";

type MatrixRow = {
  sku: string;
  [key: string]: number | string;
};

interface MatrixProps {
  data: any[];
  isLoading: boolean;
}

export function EntitlementCoverageMatrix({ data, isLoading }: MatrixProps) {
  const [search, setSearch] = useState("");

  const filteredData = useMemo(() => {
    if (!Array.isArray(data)) return [];
    return data.filter((row) => {
      const skuName = row?.sku || '';
      return skuName.toLowerCase().includes(search.toLowerCase());
    });
  }, [data, search]);

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
              {departments.map((dept) => (
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
            {isLoading ? (
              <tr>
                <td colSpan={departments.length + 1} className="p-6 text-center text-muted-foreground">
                  Loading matrix data...
                </td>
              </tr>
            ) : filteredData.length > 0 ? (
              filteredData.map((row) => (
                <tr
                  key={row.sku}
                  className="border-b last:border-none"
                >
                  <td className="px-4 py-3 font-medium">
                    {row.sku || 'N/A'}
                  </td>

                  {departments.map((dept) => (
                    <td
                      key={dept}
                      className="px-4 py-3 text-center"
                    >
                      {row[dept] !== undefined && row[dept] !== null ? (
                        <span className="inline-flex min-w-[32px] justify-center rounded bg-muted px-2 py-1">
                          {row[dept]}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={departments.length + 1}
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
