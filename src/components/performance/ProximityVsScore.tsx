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
  Cell,
} from "recharts";
import type { ProximityScorePoint } from "../../utils/scoreStats";
import type { RewardSurface } from "../../types/dart";
import type { ParsedGameSession } from "../../loaders/loadData";
import { AI_TYPE_LABELS } from "../../utils/stats";
import { AI_Type } from "../../types/dart";
import { computeGameProximity, gameScore } from "../../utils/scoreStats";
import { ChartCard } from "../ChartCard";

interface Props {
  points: ProximityScorePoint[];
  boards: Map<number, RewardSurface>;
}

const TOOLTIP_STYLE = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 6,
  padding: "8px 12px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  fontSize: 12,
};

// Okabe-Ito amber for proximity scatter
const PROXIMITY_COLOR = "#E69F00";

function GameProximityScoreBreakdown({
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

  const withProximity = data.filter((d) => d.proximity !== null) as { game: number; score: number; proximity: number }[];
  const noAdvice = data.filter((d) => d.proximity === null);

  return (
    <ChartCard
      title={`Game-level proximity vs score — ${session.user_nickname ?? session.user_uuid.slice(0, 8)} · ${AI_TYPE_LABELS[session.ai_advice]}`}
      onClose={onClose}
      style={{ marginTop: 12 }}
    >
      {withProximity.length === 0 ? (
        <p style={{ fontSize: 12, color: "#6b7280" }}>No AI advice in this session — no suggested aiming coordinates to compare against.</p>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 24 }}>
            <CartesianGrid horizontal vertical={false} stroke="#e5e7eb" />
            <XAxis
              dataKey="proximity"
              name="Proximity (px)"
              type="number"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#374151" }}
              label={{ value: "Distance from Suggested Aim (px)", position: "insideBottom", offset: -12, fontSize: 11, fill: "#374151" }}
            />
            <YAxis
              dataKey="score"
              name="Game Score"
              type="number"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#374151" }}
              label={{ value: "Game Score", angle: -90, position: "insideLeft", fontSize: 11, fill: "#374151" }}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelStyle={{ color: "#111827", fontWeight: 600 }}
              itemStyle={{ color: "#374151" }}
              formatter={(value, name) => [typeof value === "number" ? value.toFixed(1) : value, name === "proximity" ? "Proximity (px)" : name]}
            />
            <Scatter data={withProximity} isAnimationActive={false}>
              {withProximity.map((_, i) => (
                <Cell key={i} fill={PROXIMITY_COLOR} fillOpacity={0.85} stroke="#ffffff" strokeWidth={1} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      )}
      {noAdvice.length > 0 && (
        <p style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>
          {noAdvice.length} game(s) had no suggested coordinates and are excluded from the scatter.
        </p>
      )}
    </ChartCard>
  );
}

export function ProximityVsScore({ points, boards }: Props) {
  const [selected, setSelected] = useState<ParsedGameSession | null>(null);

  if (points.length === 0) {
    return (
      <ChartCard title="Proximity to Advice → Score">
        <p style={{ color: "#6b7280", fontSize: 13 }}>No session data loaded.</p>
      </ChartCard>
    );
  }

  const withProximity = points.filter((p) => p.avgProximity !== null) as (ProximityScorePoint & { avgProximity: number })[];
  const noAdvice = points.filter((p) => p.avgProximity === null);

  return (
    <>
      <ChartCard title="Proximity to Advice → Score">
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 16, right: 24, left: 0, bottom: 24 }}>
            <CartesianGrid horizontal vertical={false} stroke="#e5e7eb" />
            <XAxis
              dataKey="avgProximity"
              name="Avg Proximity (px)"
              type="number"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#374151" }}
              label={{ value: "Avg Distance from Suggested Aim (px)", position: "insideBottom", offset: -12, fontSize: 11, fill: "#374151" }}
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
                name === "avgProximity" ? "Avg Proximity (px)" : name,
              ]}
            />
            {(Object.values(AI_Type).filter((v) => typeof v === "number") as AI_Type[]).map((type) => {
              const group = withProximity.filter((p) => p.aiType === type);
              if (group.length === 0) return null;
              return (
                <Scatter
                  key={type}
                  name={AI_TYPE_LABELS[type]}
                  data={group}
                  isAnimationActive={false}
                  onClick={(data) => setSelected((data as unknown as ProximityScorePoint).session)}
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
          Lower proximity = aiming closer to AI suggestion. Click a point to see per-game breakdown.
          {noAdvice.length > 0 && ` ${noAdvice.length} NONE-condition session(s) shown separately below.`}
        </p>

        {noAdvice.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>No AI Advice sessions (scores without proximity):</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {noAdvice.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setSelected(p.session)}
                  style={{
                    fontSize: 11,
                    padding: "3px 8px",
                    background: selected?.user_uuid === p.session.user_uuid ? "#f3f4f6" : "#ffffff",
                    border: "1px solid #e5e7eb",
                    color: "#374151",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {p.session.user_nickname ?? p.session.user_uuid.slice(0, 8)} — score: {p.score.toFixed(1)}
                </button>
              ))}
            </div>
          </div>
        )}
      </ChartCard>
      {selected && (
        <GameProximityScoreBreakdown session={selected} boards={boards} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
