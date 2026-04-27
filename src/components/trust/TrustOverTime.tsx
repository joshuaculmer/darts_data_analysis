// All colors in this file must follow PALETTE.md at the project root.
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { TrustTimePoint } from "../../utils/surveyStats";
import { AI_TYPE_LABELS } from "../../utils/stats";
import { AI_Type } from "../../types/dart";
import { ChartCard } from "../ChartCard";

interface Props {
  points: TrustTimePoint[];
}

const TOOLTIP_STYLE = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 6,
  padding: "8px 12px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  fontSize: 12,
};

export function TrustOverTime({ points }: Props) {
  if (points.length === 0) {
    return (
      <ChartCard title="Trust Over Time">
        <p style={{ color: "#6b7280", fontSize: 13 }}>No trust responses found for the selected question.</p>
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Trust Over Time">
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 16, right: 24, left: 0, bottom: 24 }}>
          <CartesianGrid horizontal vertical={false} stroke="#e5e7eb" />
          <XAxis
            dataKey="sessionIndex"
            name="Session"
            type="number"
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#374151" }}
            label={{ value: "Session Number", position: "insideBottom", offset: -12, fontSize: 11, fill: "#374151" }}
          />
          <YAxis
            dataKey="trust"
            name="Trust Rating"
            type="number"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#374151" }}
          />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: "#111827", fontWeight: 600 }}
            itemStyle={{ color: "#374151" }}
            formatter={(value, name) => [value, name]}
          />
          {(Object.values(AI_Type).filter((v) => typeof v === "number") as AI_Type[]).map((type) => {
            const group = points.filter((p) => p.aiType === type);
            if (group.length === 0) return null;
            return (
              <Scatter key={type} name={AI_TYPE_LABELS[type]} data={group} isAnimationActive={false}>
                {group.map((_, i) => (
                  <Cell key={i} fill={group[0].color} fillOpacity={0.85} stroke="#ffffff" strokeWidth={1} />
                ))}
              </Scatter>
            );
          })}
        </ScatterChart>
      </ResponsiveContainer>
      <p style={{ fontSize: 11, color: "#6b7280", marginTop: -4 }}>
        Each point is one post-session survey response, colored by AI condition.
      </p>
    </ChartCard>
  );
}
