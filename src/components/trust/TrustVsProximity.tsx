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
import type { TrustVsProximityPoint } from "../../utils/surveyStats";
import type { ParsedGameSession } from "../../loaders/loadData";
import { AI_TYPE_LABELS } from "../../utils/stats";
import { AI_Type } from "../../types/dart";
import { computeGameProximity } from "../../utils/scoreStats";
import { LIKERT_TICKS, formatLikertValue, type LikertScale } from "../../utils/surveyScales";
import { ChartCard } from "../ChartCard";

interface Props {
  points: TrustVsProximityPoint[];
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

// Okabe-Ito amber — used for proximity bars (no-advice fallback uses palette --text-3)
const PROXIMITY_COLOR = "#E69F00";

function GameProximityBreakdown({
  session,
  onClose,
}: {
  session: ParsedGameSession;
  onClose: () => void;
}) {
  const data = session.games.map((g, i) => {
    const proximity = computeGameProximity(g);
    return {
      game: i + 1,
      proximity: proximity !== null ? parseFloat(proximity.toFixed(1)) : null,
      hasAdvice: proximity !== null,
    };
  });

  const hasAnyAdvice = data.some((d) => d.hasAdvice);

  return (
    <ChartCard
      title={`Game-level proximity — ${session.user_nickname ?? session.user_uuid.slice(0, 8)} · ${AI_TYPE_LABELS[session.ai_advice]}`}
      onClose={onClose}
      style={{ marginTop: 12 }}
    >
      {!hasAnyAdvice ? (
        <p style={{ fontSize: 12, color: "#6b7280" }}>No AI advice in this session — no suggested aiming coordinates to compare against.</p>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid horizontal vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="game" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#374151" }} label={{ value: "Game", position: "insideBottom", offset: -4, fontSize: 11, fill: "#374151" }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#374151" }} label={{ value: "Proximity (px)", angle: -90, position: "insideLeft", fontSize: 11, fill: "#374151" }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#111827", fontWeight: 600 }} itemStyle={{ color: "#374151" }} formatter={(v) => [v !== null ? `${v}px` : "No advice", "Proximity"]} />
            <Bar dataKey="proximity" isAnimationActive={false} radius={[0, 0, 0, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.hasAdvice ? PROXIMITY_COLOR : "#6b7280"} fillOpacity={1} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function TrustVsProximity({ points, likertScale }: Props) {
  const [selected, setSelected] = useState<ParsedGameSession | null>(null);
  const metricTitle = likertScale === "performance" ? "Performance Perception" : "Trust";

  if (points.length === 0) {
    return (
      <ChartCard title={`${metricTitle} vs Proximity to Advice`}>
        <p style={{ color: "#6b7280", fontSize: 13 }}>No matched session/survey pairs found.</p>
      </ChartCard>
    );
  }

  const withProximity = points.filter((p) => p.avgProximity !== null) as (TrustVsProximityPoint & { avgProximity: number })[];
  const noAdvice = points.filter((p) => p.avgProximity === null);

  return (
    <>
      <ChartCard title={`${metricTitle} vs Proximity to Advice`}>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 16, right: 24, left: 0, bottom: 24 }} aria-label={`${likertScale} Likert rating versus proximity to advice`}>
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
              dataKey="trust"
              name="Trust Rating"
              type="number"
              domain={[1, 5]}
              ticks={LIKERT_TICKS as unknown as number[]}
              tickFormatter={(v) => formatLikertValue(Number(v), likertScale)}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#374151" }}
              label={{ value: "Trust Rating", angle: -90, position: "insideLeft", fontSize: 11, fill: "#374151" }}
            />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              contentStyle={TOOLTIP_STYLE}
              labelStyle={{ color: "#111827", fontWeight: 600 }}
              itemStyle={{ color: "#374151" }}
              formatter={(value, name) => [
                typeof value === "number"
                  ? (name === "trust" ? formatLikertValue(value, likertScale) : value.toFixed(1))
                  : value,
                name === "avgProximity" ? "Avg Proximity (px)" : name === "trust" ? "Trust Rating" : name,
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
                  onClick={(data) => setSelected((data as unknown as TrustVsProximityPoint).session)}
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
          {noAdvice.length > 0 && ` ${noAdvice.length} NONE-condition session(s) excluded (no suggested coordinates).`}
        </p>

        {noAdvice.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>No AI Advice sessions (trust only, no proximity):</p>
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
                  {p.session.user_nickname ?? p.session.user_uuid.slice(0, 8)} — trust: {formatLikertValue(p.trust, likertScale)}
                </button>
              ))}
            </div>
          </div>
        )}
      </ChartCard>
      {selected && (
        <GameProximityBreakdown session={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
