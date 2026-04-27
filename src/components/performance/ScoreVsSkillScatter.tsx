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

const TOOLTIP_STYLE = { background: "#1e293b", border: "1px solid #334155", fontSize: 12 };

export function ScoreVsSkillScatter({ points, onSessionClick }: Props) {
  if (points.length === 0) {
    return (
      <ChartCard title="Score vs Execution Skill">
        <p style={{ color: "#475569", fontSize: 13 }}>No session data loaded.</p>
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Score vs Execution Skill">
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 16, right: 24, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="executionSkill"
            name="Execution Skill"
            type="number"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            label={{ value: "Execution Skill (preset)", position: "insideBottom", offset: -4, fontSize: 11, fill: "#64748b" }}
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
                  <Cell key={i} fill={group[0].color} fillOpacity={0.75} />
                ))}
              </Scatter>
            );
          })}
        </ScatterChart>
      </ResponsiveContainer>
      <p style={{ fontSize: 11, color: "#64748b", marginTop: -4 }}>
        Each point is one session. Execution skill is admin-preset; score is derived from game data.
      </p>
    </ChartCard>
  );
}
