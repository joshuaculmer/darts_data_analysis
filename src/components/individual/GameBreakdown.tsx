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

export function GameBreakdown({ points, selectedSessionIndex, onSelectSession }: Props) {
  const selectedPoint = points.find((p) => p.sessionIndex === selectedSessionIndex);
  const games: GameBreakdownPoint[] = selectedPoint
    ? computeGameBreakdown({ games: [] } as never, new Map()) // placeholder — actual session not wired in yet
    : [];

  // We receive IndividualSessionPoint which has score but not the raw games array.
  // The parent must pass the session directly for game-level breakdown.
  // This component renders a placeholder indicating the session needs to be passed.
  void games;

  if (points.length === 0) {
    return (
      <ChartCard title="Game-Level Breakdown">
        <p style={{ color: "#475569", fontSize: 13 }}>No sessions available.</p>
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
  // Build synthetic per-game data from the avg score — we only have summary data here.
  // When raw game data is available via a session lookup, this renders real per-game bars.
  // For now, renders a single bar representing the session average score.
  const data = [{ gameIndex: "Avg", score: point.score }];

  return (
    <>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="gameIndex" tick={{ fontSize: 11, fill: "#94a3b8" }} />
          <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
          <Tooltip
            contentStyle={{ background: "#1e293b", border: "1px solid #334155", fontSize: 12 }}
            itemStyle={{ color: "#e2e8f0" }}
          />
          <ReferenceLine y={0} stroke="#334155" />
          <Bar dataKey="score" fill={point.color} fillOpacity={0.85} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
      <p style={{ fontSize: 11, color: "#64748b", marginTop: -4 }}>
        Session {point.sessionIndex} · {point.label} condition · {point.gamesPlayed} games played
      </p>
    </>
  );
}
