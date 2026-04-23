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
import type { TrustScorePoint } from "../../utils/surveyStats";
import { AI_TYPE_LABELS } from "../../utils/stats";
import { AI_Type } from "../../types/dart";

interface Props {
  points: TrustScorePoint[];
}

const TOOLTIP_STYLE = { background: "#1e293b", border: "1px solid #334155", fontSize: 12 };

export function TrustVsScore({ points }: Props) {
  if (points.length === 0) {
    return (
      <div className="chart-card">
        <h2>Trust → Score</h2>
        <p style={{ color: "#475569", fontSize: 13 }}>No matched session/survey pairs found.</p>
      </div>
    );
  }

  return (
    <div className="chart-card">
      <h2>Trust → Score</h2>
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 16, right: 24, left: 0, bottom: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="trust"
            name="Trust Rating"
            type="number"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            label={{ value: "Trust Rating", position: "insideBottom", offset: -12, fontSize: 11, fill: "#64748b" }}
          />
          <YAxis
            dataKey="score"
            name="Avg Score"
            type="number"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            label={{ value: "Avg Score per Game", angle: -90, position: "insideLeft", fontSize: 11, fill: "#64748b" }}
          />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: "#94a3b8" }}
            itemStyle={{ color: "#e2e8f0" }}
            formatter={(value, name) => [
              typeof value === "number" ? value.toFixed(1) : value,
              name,
            ]}
          />
          {(Object.values(AI_Type).filter((v) => typeof v === "number") as AI_Type[]).map((type) => {
            const group = points.filter((p) => p.aiType === type);
            if (group.length === 0) return null;
            return (
              <Scatter key={type} name={AI_TYPE_LABELS[type]} data={group} isAnimationActive={false}>
                {group.map((_, i) => (
                  <Cell key={i} fill={group[0].color} fillOpacity={0.75} />
                ))}
              </Scatter>
            );
          })}
        </ScatterChart>
      </ResponsiveContainer>
      <p style={{ fontSize: 11, color: "#64748b", marginTop: -4 }}>
        Key research question: does higher trust in the AI translate into higher game scores?
      </p>
    </div>
  );
}
