import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { AI_Type } from "../../types/dart";
import { AI_TYPE_LABELS } from "../../utils/stats";
import type { UserConditionRow } from "../../utils/stats";

interface Props {
  rows: UserConditionRow[];
}

// Only show conditions that appear in the data, in enum order
const AI_TYPES = Object.values(AI_Type).filter((v) => typeof v === "number") as AI_Type[];

export function PairedSlopeChart({ rows }: Props) {
  // Only include users who appear in at least 2 conditions
  const multiRows = rows.filter((r) => Object.keys(r.byCondition).length >= 2);

  const activeConditions = AI_TYPES.filter((type) =>
    rows.some((r) => r.byCondition[type] !== undefined),
  );

  // Reshape: one entry per condition on x-axis, value per user as separate Line
  const chartData = activeConditions.map((type) => {
    const entry: Record<string, string | number> = { condition: AI_TYPE_LABELS[type] };
    multiRows.forEach((r) => {
      if (r.byCondition[type] !== undefined) {
        entry[r.user_uuid] = r.byCondition[type]!;
      }
    });
    return entry;
  });

  // Stable colors for user lines using index
  const USER_COLORS = [
    "#4f8ef7", "#f472b6", "#34d399", "#fb923c", "#a78bfa",
    "#f87171", "#38bdf8", "#facc15", "#a3e635",
  ];

  if (multiRows.length === 0) {
    return (
      <div className="chart-card">
        <h2>Per-User Condition Comparison</h2>
        <p style={{ color: "#64748b", fontSize: 13, marginTop: 8 }}>
          No participants with sessions in multiple conditions yet.
        </p>
      </div>
    );
  }

  return (
    <div className="chart-card">
      <h2>Per-User Execution Skill Across Conditions</h2>
      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={chartData} margin={{ top: 16, right: 24, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="condition" tick={{ fontSize: 11, fill: "#94a3b8" }} />
          <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
          <Tooltip
            contentStyle={{ background: "#1e293b", border: "1px solid #334155", fontSize: 12 }}
            labelStyle={{ color: "#94a3b8" }}
            itemStyle={{ color: "#e2e8f0" }}
          />
          {multiRows.map((r, i) => (
            <Line
              key={r.user_uuid}
              type="monotone"
              dataKey={r.user_uuid}
              name={r.user_nickname ?? r.user_uuid}
              stroke={USER_COLORS[i % USER_COLORS.length]}
              strokeWidth={1.5}
              dot={{ r: 3 }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <p style={{ fontSize: 11, color: "#64748b", marginTop: -4 }}>
        Each line is one participant. Only participants with 2+ conditions shown.
      </p>
    </div>
  );
}
