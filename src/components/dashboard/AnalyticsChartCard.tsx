import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface AnalyticsChartCardProps {
  type: "bar" | "line" | "donut";
  data: any[];
  xKey?: string;
  yKey?: string;
}

const COLORS = ["#2563eb", "#16a34a", "#f97316", "#9333ea"];

export function AnalyticsChartCard({
  type,
  data,
  xKey = "name",
  yKey = "value",
}: AnalyticsChartCardProps) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        {type === "bar" && (
          <BarChart data={data}>
            <XAxis dataKey={xKey} />
            <YAxis />
            <Tooltip />
            <Bar
              dataKey={yKey}
              fill="#2563eb"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        )}

        {type === "line" && (
          <LineChart data={data}>
            <XAxis dataKey={xKey} />
            <YAxis />
            <Tooltip />
            <Line
              type="monotone"
              dataKey={yKey}
              stroke="#2563eb"
              strokeWidth={2}
            />
          </LineChart>
        )}

        {type === "donut" && (
          <PieChart>
            <Tooltip />
            <Pie
              data={data}
              dataKey={yKey}
              nameKey={xKey}
              innerRadius={60}
              outerRadius={90}
              paddingAngle={4}
            >
              {data.map((_, index) => (
                <Cell
                  key={index}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
          </PieChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
