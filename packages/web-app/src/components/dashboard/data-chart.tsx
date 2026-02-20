"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface DataChartProps {
  type: "bar" | "line" | "pie";
  data: Record<string, unknown>[];
  xKey: string;
  yKey: string;
}

const CHART_COLORS = [
  "#3b82f6", // blue (accent)
  "#1e3a5f", // dark blue (primary)
  "#22c55e", // green (success)
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // purple
  "#06b6d4", // cyan
  "#f97316", // orange
  "#ec4899", // pink
  "#14b8a6", // teal
];

export function DataChart({ type, data, xKey, yKey }: DataChartProps) {
  // Prepare data: ensure numeric values
  const chartData = data.slice(0, type === "pie" ? 10 : 50).map((row) => ({
    ...row,
    [yKey]: Number(row[yKey]) || 0,
    [xKey]: String(row[xKey] ?? ""),
  }));

  if (chartData.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-gray-500">
        No data to chart
      </div>
    );
  }

  return (
    <div className="w-full rounded-lg border border-gray-200 bg-white p-4">
      <ResponsiveContainer width="100%" height={400}>
        {type === "bar" ? (
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey={xKey}
              tick={{ fontSize: 11 }}
              interval={0}
              angle={chartData.length > 10 ? -45 : 0}
              textAnchor={chartData.length > 10 ? "end" : "middle"}
              height={chartData.length > 10 ? 80 : 30}
            />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey={yKey} fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        ) : type === "line" ? (
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey={yKey}
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        ) : (
          <PieChart>
            <Pie
              data={chartData}
              dataKey={yKey}
              nameKey={xKey}
              cx="50%"
              cy="50%"
              outerRadius={150}
              label={(props) =>
                `${props.name ?? ""}: ${(((props.percent as number) ?? 0) * 100).toFixed(0)}%`
              }
              labelLine
            >
              {chartData.map((_, i) => (
                <Cell
                  key={i}
                  fill={CHART_COLORS[i % CHART_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
