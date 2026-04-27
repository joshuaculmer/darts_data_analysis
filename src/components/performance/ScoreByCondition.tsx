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

const TOOLTIP_STYLE = { background: "#1e293b", border: "1px solid #334155", fontSize: 12 };

export function ScoreByCondition({ stats }: Props) {
  const data = stats
    .filter((s) => s.count > 0)
    .map((s) => ({
      condition: s.label,
      mean: parseFloat(s.mean.toFixed(2)),
      ci95: parseFloat(s.ci95.toFixed(2)),
      color: s.color,
      count: s.count,
    }));

  if (data.length === 0) {
    return (
      <ChartCard title="Mean Score by AI Condition">
        <p style={{ color: "#475569", fontSize: 13 }}>No session data loaded.</p>
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Mean Score by AI Condition">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 16, right: 24, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="condition" tick={{ fontSize: 11, fill: "#94a3b8" }} />
          <YAxis
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            label={{ value: "Avg Score per Game", angle: -90, position: "insideLeft", fontSize: 11, fill: "#64748b" }}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: "#94a3b8" }}
            itemStyle={{ color: "#e2e8f0" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as typeof data[0];
              return (
                <div style={{ ...TOOLTIP_STYLE, padding: "8px 12px", borderRadius: 6 }}>
                  <p style={{ margin: 0, color: "#f1f5f9", fontWeight: 600 }}>{d.condition}</p>
                  <p style={{ margin: "4px 0 0", color: "#e2e8f0" }}>Mean: {d.mean.toFixed(2)}</p>
                  <p style={{ margin: "2px 0 0", color: "#94a3b8" }}>±CI95: {d.ci95.toFixed(2)}</p>
                  <p style={{ margin: "2px 0 0", color: "#64748b" }}>n = {d.count} sessions</p>
                </div>
              );
            }}
          />
          <Bar dataKey="mean" isAnimationActive={false} radius={[4, 4, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} fillOpacity={0.85} />
            ))}
            <ErrorBar dataKey="ci95" width={4} strokeWidth={2} stroke="#f1f5f9" strokeOpacity={0.6} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p style={{ fontSize: 11, color: "#64748b", marginTop: -4 }}>
        Each bar = mean avg score per session for that AI condition. Error bars = 95% CI.
      </p>
    </ChartCard>
  );
}
