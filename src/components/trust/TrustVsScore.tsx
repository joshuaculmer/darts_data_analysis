// All colors in this file must follow PALETTE.md at the project root.
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
import { LIKERT_TICKS, formatLikertValue, type LikertScale } from "../../utils/surveyScales";
import { ChartCard } from "../ChartCard";

interface Props {
  points: TrustScorePoint[];
  boards: Map<number, RewardSurface>;
  likertScale: LikertScale;
}

const TOOLTIP_STYLE = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 6,
  padding: "8px 12px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  fontSize: 12,
};

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
          <CartesianGrid horizontal vertical={false} stroke="#e5e7eb" />
          <XAxis dataKey="game" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#374151" }} label={{ value: "Game", position: "insideBottom", offset: -4, fontSize: 11, fill: "#374151" }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#374151" }} label={{ value: "Score", angle: -90, position: "insideLeft", fontSize: 11, fill: "#374151" }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#111827", fontWeight: 600 }} itemStyle={{ color: "#374151" }} formatter={(v) => [typeof v === "number" ? v.toFixed(1) : v, "Score"]} />
          <Bar dataKey="score" isAnimationActive={false} radius={[0, 0, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill="#0072B2" fillOpacity={1} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function TrustVsScore({ points, boards, likertScale }: Props) {
  const [selected, setSelected] = useState<ParsedGameSession | null>(null);
  const metricTitle = likertScale === "performance" ? "Performance Perception" : "Trust";
  const metricAxisLabel = likertScale === "performance" ? "Performance Perception Rating" : "Trust Rating";

  if (points.length === 0) {
    return (
      <ChartCard title={`${metricTitle} vs Score`}>
        <p style={{ color: "#6b7280", fontSize: 13 }}>No matched session/survey pairs found.</p>
      </ChartCard>
    );
  }

  return (
    <>
      <ChartCard title={`${metricTitle} vs Score`}>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 16, right: 24, left: 0, bottom: 24 }} aria-label={`${likertScale} Likert rating versus score`}>
            <CartesianGrid horizontal vertical={false} stroke="#e5e7eb" />
            <XAxis
              dataKey="trust"
              name={metricAxisLabel}
              type="number"
              domain={[1, 5]}
              ticks={LIKERT_TICKS as unknown as number[]}
              tickFormatter={(v) => formatLikertValue(Number(v), likertScale)}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#374151" }}
              label={{ value: metricAxisLabel, position: "insideBottom", offset: -12, fontSize: 11, fill: "#374151" }}
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
              formatter={(value, name) => {
                if (name === "trust" && typeof value === "number") return [formatLikertValue(value, likertScale), metricAxisLabel];
                return [typeof value === "number" ? value.toFixed(1) : value, name];
              }}
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
                      stroke={selected?.user_uuid === p.session.user_uuid ? "#ffffff" : "none"}
                      strokeWidth={2}
                    />
                  ))}
                </Scatter>
              );
            })}
          </ScatterChart>
        </ResponsiveContainer>
        <p style={{ fontSize: 11, color: "#6b7280", marginTop: -4 }}>
          Each point is one session. Click a point to see per-game scores.
        </p>
      </ChartCard>
      {selected && (
        <GameScoreBreakdown session={selected} boards={boards} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
