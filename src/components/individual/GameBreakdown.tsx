import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { IndividualSessionPoint } from "../../utils/individualStats";
import type { GameBreakdownPoint } from "../../utils/individualStats";
import { computeGameBreakdown } from "../../utils/individualStats";
import { ChartCard } from "../ChartCard";

interface Props {
  points: IndividualSessionPoint[];
  selectedSessionIndex: number;
  onSelectSession: (idx: number) => void;
}

const TOOLTIP_STYLE = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 6,
  padding: "8px 12px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  fontSize: 12,
};

export function GameBreakdown({ points, selectedSessionIndex, onSelectSession }: Props) {
  const selectedPoint = points.find((p) => p.sessionIndex === selectedSessionIndex);
  const games: GameBreakdownPoint[] = selectedPoint
    ? computeGameBreakdown({ games: [] } as never, new Map())
    : [];

  void games;

  if (points.length === 0) {
    return (
      <ChartCard title="Game-Level Breakdown">
        <p style={{ color: "#6b7280", fontSize: 13 }}>No sessions available.</p>
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Game-Level Breakdown">
      <div className="session-tabs">
        {points.map((p) => (
          <button
            key={p.sessionIndex}
            className={`session-tab${p.sessionIndex === selectedSessionIndex ? " session-tab--active" : ""}`}
            style={p.sessionIndex === selectedSessionIndex ? { borderColor: p.color, color: p.color } : {}}
            onClick={() => onSelectSession(p.sessionIndex)}
          >
            S{p.sessionIndex}
          </button>
        ))}
      </div>
      {selectedPoint && <GameBarChart point={selectedPoint} />}
    </ChartCard>
  );
}

function GameBarChart({ point }: { point: IndividualSessionPoint }) {
  const data = [{ gameIndex: "Avg", score: point.score }];

  return (
    <>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid horizontal vertical={false} stroke="#e5e7eb" strokeDasharray="none" />
          <XAxis
            dataKey="gameIndex"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#374151" }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#374151" }}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: "#111827", fontWeight: 600 }}
            itemStyle={{ color: "#374151" }}
          />
          <ReferenceLine y={0} stroke="#d1d5db" strokeDasharray="4 3" />
          <Bar dataKey="score" fill={point.color} fillOpacity={1} radius={[0, 0, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
      <p style={{ fontSize: 11, color: "#6b7280", marginTop: -4 }}>
        Session {point.sessionIndex} · {point.label} condition · {point.gamesPlayed} games played
      </p>
    </>
  );
}
