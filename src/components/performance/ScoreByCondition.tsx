import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ErrorBar,
} from "recharts";
import type { ScoreConditionStats } from "../../utils/scoreStats";
import { ChartCard } from "../ChartCard";

interface Props {
  stats: ScoreConditionStats[];
}

const TOOLTIP_STYLE = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 6,
  padding: "8px 12px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  fontSize: 12,
};

export function ScoreByCondition({ stats }: Props) {
  if (stats.length === 0) {
    return (
      <ChartCard title="Mean Score by AI Condition">
        <p style={{ color: "#6b7280", fontSize: 13 }}>No session data loaded.</p>
      </ChartCard>
    );
  }

  const data = stats.map((s) => ({
    condition: s.label,
    mean: s.count > 0 ? parseFloat(s.mean.toFixed(2)) : 0,
    ci95: s.count > 0 ? parseFloat(s.ci95.toFixed(2)) : 0,
    color: s.color,
    count: s.count,
  }));

  return (
    <ChartCard title="Mean Score by AI Condition">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 16, right: 24, left: 0, bottom: 8 }}>
          <CartesianGrid horizontal vertical={false} stroke="#e5e7eb" strokeDasharray="none" />
          <XAxis
            dataKey="condition"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#374151" }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#374151" }}
            label={{ value: "Avg Score per Game", angle: -90, position: "insideLeft", fontSize: 11, fill: "#374151" }}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: "#111827", fontWeight: 600 }}
            itemStyle={{ color: "#374151" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as typeof data[0];
              return (
                <div style={TOOLTIP_STYLE}>
                  <p style={{ margin: 0, color: "#111827", fontWeight: 600 }}>{d.condition}</p>
                  {d.count > 0 ? (
                    <>
                      <p style={{ margin: "4px 0 0", color: "#374151" }}>Mean: {d.mean.toFixed(2)}</p>
                      <p style={{ margin: "2px 0 0", color: "#374151" }}>±CI95: {d.ci95.toFixed(2)}</p>
                      <p style={{ margin: "2px 0 0", color: "#6b7280" }}>n = {d.count} sessions</p>
                    </>
                  ) : (
                    <p style={{ margin: "4px 0 0", color: "#6b7280" }}>No data yet</p>
                  )}
                </div>
              );
            }}
          />
          <Bar dataKey="mean" isAnimationActive={false} radius={[0, 0, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} fillOpacity={d.count > 0 ? 1 : 0.2} />
            ))}
            <ErrorBar dataKey="ci95" width={4} strokeWidth={1.5} stroke="#374151" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p style={{ fontSize: 11, color: "#6b7280", marginTop: -4 }}>
        Each bar = mean avg score per session for that AI condition. Error bars = 95% CI. Faded bars have no data.
      </p>
    </ChartCard>
  );
}
