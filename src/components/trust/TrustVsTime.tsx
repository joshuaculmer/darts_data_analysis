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
import type { TrustVsTimePoint } from "../../utils/surveyStats";
import type { ParsedGameSession } from "../../loaders/loadData";
import { AI_TYPE_LABELS } from "../../utils/stats";
import { AI_Type } from "../../types/dart";
import { computeGameDurationSecs } from "../../utils/scoreStats";
import { LIKERT_TICKS, formatLikertValue, type LikertScale } from "../../utils/surveyScales";
import { ChartCard } from "../ChartCard";

interface Props {
  points: TrustVsTimePoint[];
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
    <ChartCard
      title={`Game-level duration — ${session.user_nickname ?? session.user_uuid.slice(0, 8)} · ${AI_TYPE_LABELS[session.ai_advice]}`}
      onClose={onClose}
      style={{ marginTop: 12 }}
    >
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid horizontal vertical={false} stroke="#e5e7eb" />
          <XAxis dataKey="game" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#374151" }} label={{ value: "Game", position: "insideBottom", offset: -4, fontSize: 11, fill: "#374151" }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#374151" }} label={{ value: "Duration (s)", angle: -90, position: "insideLeft", fontSize: 11, fill: "#374151" }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#111827", fontWeight: 600 }} itemStyle={{ color: "#374151" }} formatter={(v) => [`${v}s`, "Duration"]} />
          <Bar dataKey="duration" isAnimationActive={false} radius={[0, 0, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill="#009E73" fillOpacity={1} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function TrustVsTime({ points, likertScale }: Props) {
  const [selected, setSelected] = useState<ParsedGameSession | null>(null);

  if (points.length === 0) {
    return (
      <ChartCard title="Trust → Time per Game">
        <p style={{ color: "#6b7280", fontSize: 13 }}>No matched session/survey pairs found.</p>
      </ChartCard>
    );
  }

  return (
    <>
      <ChartCard title="Trust → Time per Game">
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 16, right: 24, left: 0, bottom: 24 }} aria-label={`${likertScale} Likert rating versus time per game`}>
            <CartesianGrid horizontal vertical={false} stroke="#e5e7eb" />
            <XAxis
              dataKey="avgTimeSecs"
              name="Avg Time (s)"
              type="number"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#374151" }}
              label={{ value: "Avg Time per Game (s)", position: "insideBottom", offset: -12, fontSize: 11, fill: "#374151" }}
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
                name === "avgTimeSecs" ? "Avg Time (s)" : name === "trust" ? "Trust Rating" : name,
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
          Each point is one session (avg game duration). Click a point to see per-game durations.
        </p>
      </ChartCard>
      {selected && (
        <GameDurationBreakdown session={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
