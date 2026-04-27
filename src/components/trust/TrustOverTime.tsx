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

export function TrustOverTime({ points }: Props) {
  if (points.length === 0) {
    return (
      <ChartCard title="Trust Over Time">
        <p style={{ color: "#475569", fontSize: 13 }}>No trust responses found for the selected question.</p>
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Trust Over Time">
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 16, right: 24, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="date"
            name="Date"
            type="category"
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            angle={-30}
            textAnchor="end"
            height={48}
          />
          <YAxis
            dataKey="trust"
            name="Trust Rating"
            type="number"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
          />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            contentStyle={{ background: "#1e293b", border: "1px solid #334155", fontSize: 12 }}
            labelStyle={{ color: "#94a3b8" }}
            itemStyle={{ color: "#e2e8f0" }}
            formatter={(value, name) => [value, name]}
          />
          {(Object.values(AI_Type).filter((v) => typeof v === "number") as AI_Type[]).map((type) => {
            const group = points.filter((p) => p.aiType === type);
            if (group.length === 0) return null;
            return (
              <Scatter key={type} name={AI_TYPE_LABELS[type]} data={group} isAnimationActive={false}>
                {group.map((_, i) => (
                  <Cell key={i} fill={group[0].color} fillOpacity={0.8} />
                ))}
              </Scatter>
            );
          })}
        </ScatterChart>
      </ResponsiveContainer>
      <p style={{ fontSize: 11, color: "#64748b", marginTop: -4 }}>
        Each point is one post-session survey response, colored by AI condition.
      </p>
    </ChartCard>
  );
}
