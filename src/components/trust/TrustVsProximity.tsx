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
  ReferenceLine,
} from "recharts";
import type { TrustVsProximityPoint } from "../../utils/surveyStats";
import type { ParsedGameSession } from "../../loaders/loadData";
import { AI_TYPE_LABELS } from "../../utils/stats";
import { AI_Type } from "../../types/dart";
import { computeGameProximity } from "../../utils/scoreStats";
import { ChartCard } from "../ChartCard";

interface Props {
  points: TrustVsProximityPoint[];
}

const TOOLTIP_STYLE = { background: "#1e293b", border: "1px solid #334155", fontSize: 12 };
const NULL_COLOR = "#64748b";

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
        <p style={{ fontSize: 12, color: "#64748b" }}>No AI advice in this session — no suggested aiming coordinates to compare against.</p>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="game" tick={{ fontSize: 11, fill: "#94a3b8" }} label={{ value: "Game", position: "insideBottom", offset: -4, fontSize: 11, fill: "#64748b" }} />
            <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} label={{ value: "Proximity (px)", angle: -90, position: "insideLeft", fontSize: 11, fill: "#64748b" }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={{ color: "#e2e8f0" }} formatter={(v) => [v !== null ? `${v}px` : "No advice", "Proximity"]} />
            <Bar dataKey="proximity" isAnimationActive={false}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.hasAdvice ? "#f59e0b" : NULL_COLOR} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function TrustVsProximity({ points }: Props) {
  const [selected, setSelected] = useState<ParsedGameSession | null>(null);

  if (points.length === 0) {
    return (
      <ChartCard title="Trust → Proximity to Advice">
        <p style={{ color: "#475569", fontSize: 13 }}>No matched session/survey pairs found.</p>
      </ChartCard>
    );
  }

  const withProximity = points.filter((p) => p.avgProximity !== null) as (TrustVsProximityPoint & { avgProximity: number })[];
  const noAdvice = points.filter((p) => p.avgProximity === null);

  return (
    <>
      <ChartCard title="Trust → Proximity to Advice">
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 16, right: 24, left: 0, bottom: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="avgProximity"
              name="Avg Proximity (px)"
              type="number"
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              label={{ value: "Avg Distance from Suggested Aim (px)", position: "insideBottom", offset: -12, fontSize: 11, fill: "#64748b" }}
            />
            <YAxis
              dataKey="trust"
              name="Trust Rating"
              type="number"
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              label={{ value: "Trust Rating", angle: -90, position: "insideLeft", fontSize: 11, fill: "#64748b" }}
            />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              contentStyle={TOOLTIP_STYLE}
              labelStyle={{ color: "#94a3b8" }}
              itemStyle={{ color: "#e2e8f0" }}
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
                  onClick={(data) => setSelected((data as unknown as TrustVsProximityPoint).session)}
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
          Lower proximity = aiming closer to AI suggestion. Click a point to see per-game breakdown.
          {noAdvice.length > 0 && ` ${noAdvice.length} NONE-condition session(s) excluded (no suggested coordinates).`}
        </p>

        {noAdvice.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>No AI Advice sessions (trust only, no proximity):</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {noAdvice.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setSelected(p.session)}
                  style={{
                    fontSize: 11,
                    padding: "3px 8px",
                    background: selected?.user_uuid === p.session.user_uuid ? "#334155" : "#1e293b",
                    border: `1px solid ${NULL_COLOR}`,
                    color: "#94a3b8",
                    borderRadius: 4,
                    cursor: "pointer",
                  }}
                >
                  {p.session.user_nickname ?? p.session.user_uuid.slice(0, 8)} — trust: {p.trust}
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
