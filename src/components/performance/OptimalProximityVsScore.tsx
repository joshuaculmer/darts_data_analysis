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
import type { OptimalProximityScorePoint } from "../../utils/scoreStats";
import type { RewardSurface } from "../../types/dart";
import type { ParsedGameSession } from "../../loaders/loadData";
import { AI_TYPE_LABELS } from "../../utils/stats";
import { AI_Type } from "../../types/dart";
import { computeGameOptimalProximity, gameScore } from "../../utils/scoreStats";
import { ChartCard } from "../ChartCard";
import { PointClickModeToggle, type PointClickMode } from "../PointClickModeToggle";

interface Props {
  points: OptimalProximityScorePoint[];
  boards: Map<number, RewardSurface>;
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

function GameOptimalProximityBreakdown({
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
    const proximity = computeGameOptimalProximity(g, session.execution_skill);
    return { game: i + 1, score, proximity };
  });

  const withProximity = data.filter((d) => d.proximity !== null) as { game: number; score: number; proximity: number }[];
  const noLookup = data.filter((d) => d.proximity === null);

  return (
    <ChartCard
      title={`Game-level proximity to optimal → score — ${session.user_nickname ?? session.user_uuid.slice(0, 8)} · ${AI_TYPE_LABELS[session.ai_advice]}`}
      onClose={onClose}
      style={{ marginTop: 12 }}
    >
      {withProximity.length === 0 ? (
        <p style={{ fontSize: 12, color: "#6b7280" }}>No optimal aiming data available for this session's boards.</p>
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
              label={{ value: "Distance from Optimal Aim (px)", position: "insideBottom", offset: -12, fontSize: 11, fill: "#374151" }}
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
                <Cell key={i} fill="#1d4ed8" fillOpacity={0.85} stroke="#ffffff" strokeWidth={1} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      )}
      {noLookup.length > 0 && (
        <p style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>
          {noLookup.length} game(s) had no optimal aiming data available and are excluded from the scatter.
        </p>
      )}
    </ChartCard>
  );
}

export function OptimalProximityVsScore({ points, boards, onSessionClick }: Props) {
  const [mode, setMode] = useState<PointClickMode>("navigate");
  const [selectedSession, setSelectedSession] = useState<ParsedGameSession | null>(null);

  function handleModeChange(next: PointClickMode) {
    setMode(next);
    setSelectedSession(null);
  }

  function handleClick(p: OptimalProximityScorePoint) {
    if (mode === "navigate") {
      onSessionClick?.(p.session.user_uuid, p.sessionIndex);
    } else {
      setSelectedSession((prev) => (prev === p.session ? null : p.session));
    }
  }

  if (points.length === 0) {
    return (
      <ChartCard title="Proximity to Optimal Aim → Score">
        <p style={{ color: "#6b7280", fontSize: 13 }}>No session data loaded.</p>
      </ChartCard>
    );
  }

  const withProximity = points.filter((p) => p.avgProximity !== null) as (OptimalProximityScorePoint & { avgProximity: number })[];
  const selectedUuid = selectedSession?.user_uuid ?? null;

  return (
    <>
      <ChartCard title="Proximity to Optimal Aim → Score">
        <PointClickModeToggle mode={mode} onChange={handleModeChange} />
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
              label={{ value: "Avg Distance from Optimal Aim (px)", position: "insideBottom", offset: -12, fontSize: 11, fill: "#374151" }}
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
                  onClick={(data) => handleClick(data as unknown as OptimalProximityScorePoint)}
                  style={{ cursor: "pointer" }}
                >
                  {group.map((p, i) => {
                    const isHighlighted = selectedUuid !== null && p.session.user_uuid === selectedUuid;
                    const isDimmed = selectedUuid !== null && p.session.user_uuid !== selectedUuid;
                    return (
                      <Cell
                        key={i}
                        fill={p.color}
                        fillOpacity={isDimmed ? 0.25 : 0.85}
                        stroke={isHighlighted ? "#111827" : "none"}
                        strokeWidth={isHighlighted ? 2 : 0}
                      />
                    );
                  })}
                </Scatter>
              );
            })}
          </ScatterChart>
        </ResponsiveContainer>
        <p style={{ fontSize: 11, color: "#6b7280", marginTop: -4 }}>
          {mode === "navigate"
            ? "Each point is one session. Click to open its session in Session View."
            : "Each point is one session. Click to highlight all sessions from that participant and see per-game breakdown."}
        </p>
      </ChartCard>
      {mode === "highlight" && selectedSession && (
        <GameOptimalProximityBreakdown session={selectedSession} boards={boards} onClose={() => setSelectedSession(null)} />
      )}
    </>
  );
}
