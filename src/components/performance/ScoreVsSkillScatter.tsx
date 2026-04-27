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
import type { ScoreSkillPoint } from "../../utils/scoreStats";
import { AI_TYPE_LABELS } from "../../utils/stats";
import { AI_Type } from "../../types/dart";
import { ChartCard } from "../ChartCard";

interface Props {
  points: ScoreSkillPoint[];
  onSessionClick?: (user_uuid: string, sessionIndex: number) => void;
}

const TOOLTIP_STYLE = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 6,
  padding: "8px 12px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  fontSize: 12,
};

export function ScoreVsSkillScatter({ points, onSessionClick }: Props) {
  if (points.length === 0) {
    return (
      <ChartCard title="Score vs Execution Skill">
        <p style={{ color: "#6b7280", fontSize: 13 }}>No session data loaded.</p>
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Score vs Execution Skill">
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 16, right: 24, left: 0, bottom: 8 }}>
          <CartesianGrid horizontal vertical={false} stroke="#e5e7eb" />
          <XAxis
            dataKey="executionSkill"
            name="Execution Skill"
            type="number"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#374151" }}
            label={{ value: "Execution Skill (preset)", position: "insideBottom", offset: -4, fontSize: 11, fill: "#374151" }}
          />
          <YAxis
            dataKey="score"
            name="Avg Score"
            type="number"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#374151" }}
            label={{ value: "Avg Score per Game", angle: -90, position: "insideLeft", fontSize: 11, fill: "#374151" }}
          />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: "#111827", fontWeight: 600 }}
            itemStyle={{ color: "#374151" }}
            formatter={(value, name) => [
              typeof value === "number" ? value.toFixed(1) : value,
              name,
            ]}
          />
          {(Object.values(AI_Type).filter((v) => typeof v === "number") as AI_Type[]).map((type) => {
            const group = points.filter((p) => p.aiType === type);
            if (group.length === 0) return null;
            return (
              <Scatter
                key={type}
                name={AI_TYPE_LABELS[type]}
                data={group}
                isAnimationActive={false}
                onClick={onSessionClick ? (data) => {
                  const p = data as unknown as ScoreSkillPoint;
                  onSessionClick(p.user_uuid, p.sessionIndex);
                } : undefined}
                style={onSessionClick ? { cursor: "pointer" } : undefined}
              >
                {group.map((_, i) => (
                  <Cell key={i} fill={group[0].color} fillOpacity={0.85} stroke="#ffffff" strokeWidth={1} />
                ))}
              </Scatter>
            );
          })}
        </ScatterChart>
      </ResponsiveContainer>
      <p style={{ fontSize: 11, color: "#6b7280", marginTop: -4 }}>
        Each point is one session. Execution skill is admin-preset; score is derived from game data.
      </p>
    </ChartCard>
  );
}
