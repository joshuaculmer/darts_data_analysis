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
import type { TrustVsTimePoint } from "../../utils/surveyStats";
import type { ParsedGameSession } from "../../loaders/loadData";
import { AI_TYPE_LABELS } from "../../utils/stats";
import { AI_Type } from "../../types/dart";
import { computeGameDurationSecs } from "../../utils/scoreStats";

interface Props {
  points: TrustVsTimePoint[];
}

const TOOLTIP_STYLE = { background: "#1e293b", border: "1px solid #334155", fontSize: 12 };

function GameDurationBreakdown({
  session,
  onClose,
}: {
  session: ParsedGameSession;
  onClose: () => void;
}) {
  const data = session.games.map((g, i) => ({
    game: i + 1,
    duration: parseFloat(computeGameDurationSecs(g).toFixed(1)),
  }));

  return (
    <div className="chart-card" style={{ marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: 14 }}>
          Game-level duration — {session.user_nickname ?? session.user_uuid.slice(0, 8)} · {AI_TYPE_LABELS[session.ai_advice]}
        </h3>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 16 }}>×</button>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="game" tick={{ fontSize: 11, fill: "#94a3b8" }} label={{ value: "Game", position: "insideBottom", offset: -4, fontSize: 11, fill: "#64748b" }} />
          <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} label={{ value: "Duration (s)", angle: -90, position: "insideLeft", fontSize: 11, fill: "#64748b" }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={{ color: "#e2e8f0" }} formatter={(v) => [`${v}s`, "Duration"]} />
          <Bar dataKey="duration" isAnimationActive={false}>
            {data.map((_, i) => (
              <Cell key={i} fill="#8b5cf6" fillOpacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrustVsTime({ points }: Props) {
  const [selected, setSelected] = useState<ParsedGameSession | null>(null);

  if (points.length === 0) {
    return (
      <div className="chart-card">
        <h2>Trust → Time per Game</h2>
        <p style={{ color: "#475569", fontSize: 13 }}>No matched session/survey pairs found.</p>
      </div>
    );
  }

  return (
    <>
      <div className="chart-card">
        <h2>Trust → Time per Game</h2>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 16, right: 24, left: 0, bottom: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="avgTimeSecs"
              name="Avg Time (s)"
              type="number"
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              label={{ value: "Avg Time per Game (s)", position: "insideBottom", offset: -12, fontSize: 11, fill: "#64748b" }}
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
                name === "avgTimeSecs" ? "Avg Time (s)" : name,
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
                  onClick={(data) => setSelected((data as unknown as TrustVsTimePoint).session)}
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
          Each point is one session (avg game duration). Click a point to see per-game durations.
        </p>
      </div>
      {selected && (
        <GameDurationBreakdown session={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
