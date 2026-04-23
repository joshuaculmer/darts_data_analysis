import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { AI_Type } from "../../types/dart";
import { AI_TYPE_LABELS, AI_TYPE_COLORS } from "../../utils/stats";
import type { ScatterPoint } from "../../utils/stats";

interface Props {
  points: ScatterPoint[];
}

const AI_TYPES = Object.values(AI_Type).filter((v) => typeof v === "number") as AI_Type[];

export function ExecutionSkillScatter({ points }: Props) {
  return (
    <div className="chart-card">
      <h2>Games Played vs Execution Skill by Condition</h2>
      <ResponsiveContainer width="100%" height={340}>
        <ScatterChart margin={{ top: 16, right: 24, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="gamesPlayed"
            name="Games Played"
            type="number"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            label={{ value: "Games Played", position: "insideBottom", offset: -4, fontSize: 11, fill: "#64748b" }}
          />
          <YAxis
            dataKey="executionSkill"
            name="Execution Skill"
            type="number"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
          />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            contentStyle={{ background: "#1e293b", border: "1px solid #334155", fontSize: 12 }}
            labelStyle={{ color: "#94a3b8" }}
            itemStyle={{ color: "#e2e8f0" }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
          {AI_TYPES.map((type) => (
            <Scatter
              key={type}
              name={AI_TYPE_LABELS[type]}
              data={points.filter((p) => p.aiType === type)}
              fill={AI_TYPE_COLORS[type]}
              fillOpacity={0.75}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
