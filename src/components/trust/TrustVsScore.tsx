import { useState } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import type { TrustScorePoint } from "../../utils/surveyStats";
import type { RewardSurface } from "../../types/dart";
import type { ParsedGameSession } from "../../loaders/loadData";
import { AI_TYPE_LABELS } from "../../utils/stats";
import { AI_Type } from "../../types/dart";
import { gameScore, computeGameProximity } from "../../utils/scoreStats";
import { ChartCard } from "../ChartCard";

interface Props {
  points: TrustScorePoint[];
  boards: Map<number, RewardSurface>;
}

const TOOLTIP_STYLE = { background: "#1e293b", border: "1px solid #334155", fontSize: 12 };
const NULL_COLOR = "#64748b";

function GameScoreBreakdown({
  session,
  boards,
  onClose,
}: {
  session: ParsedGameSession;
  boards: Map<number, RewardSurface>;
  onClose: () => void;
}) {
  const data = session.games.map((g, i) => {
    const surface = boards.get(g.board_id);
    const score = surface ? gameScore(g, surface) : 0;
    const proximity = computeGameProximity(g);
    return { game: i + 1, score, proximity };
  });

  return (
    <ChartCard
      title={`Game-level scores — ${session.user_nickname ?? session.user_uuid.slice(0, 8)} · ${AI_TYPE_LABELS[session.ai_advice]}`}
      onClose={onClose}
      style={{ marginTop: 12 }}
    >
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="game" tick={{ fontSize: 11, fill: "#94a3b8" }} label={{ value: "Game", position: "insideBottom", offset: -4, fontSize: 11, fill: "#64748b" }} />
          <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} label={{ value: "Score", angle: -90, position: "insideLeft", fontSize: 11, fill: "#64748b" }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={{ color: "#e2e8f0" }} formatter={(v) => [typeof v === "number" ? v.toFixed(1) : v, "Score"]} />
          <Bar dataKey="score" isAnimationActive={false}>
            {data.map((_, i) => (
              <Cell key={i} fill="#3b82f6" fillOpacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function TrustVsScore({ points, boards }: Props) {
  const [selected, setSelected] = useState<ParsedGameSession | null>(null);

  if (points.length === 0) {
    return (
      <ChartCard title="Trust → Score">
        <p style={{ color: "#475569", fontSize: 13 }}>No matched session/survey pairs found.</p>
      </ChartCard>
    );
  }

  return (
    <>
      <ChartCard title="Trust → Score">
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
              formatter={(value, name) => [typeof value === "number" ? value.toFixed(1) : value, name]}
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
                  onClick={(data) => setSelected((data as unknown as TrustScorePoint).session)}
                  style={{ cursor: "pointer" }}
                >
                  {group.map((p, i) => (
                    <Cell
                      key={i}
                      fill={p.color}
                      fillOpacity={selected?.user_uuid === p.session.user_uuid ? 1 : 0.75}
                      stroke={selected?.user_uuid === p.session.user_uuid ? "#fff" : "none"}
                      strokeWidth={2}
                    />
                  ))}
                </Scatter>
              );
            })}
          </ScatterChart>
        </ResponsiveContainer>
        <p style={{ fontSize: 11, color: "#64748b", marginTop: -4 }}>
          Each point is one session. Click a point to see per-game scores.
        </p>
      </ChartCard>
      {selected && (
        <GameScoreBreakdown session={selected} boards={boards} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
