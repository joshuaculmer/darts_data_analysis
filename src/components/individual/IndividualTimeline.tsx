import {
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { IndividualSessionPoint } from "../../utils/individualStats";
import { ChartCard } from "../ChartCard";

interface Props {
  points: IndividualSessionPoint[];
  showTrust: boolean;
}

const SCORE_COLOR = "#4f8ef7";
const TRUST_COLOR = "#34d399";

export function IndividualTimeline({ points, showTrust }: Props) {
  if (points.length === 0) {
    return (
      <ChartCard title="Score & Trust Over Sessions">
        <p style={{ color: "#475569", fontSize: 13 }}>No sessions found for this participant.</p>
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Score & Trust Over Sessions">
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={points} margin={{ top: 16, right: 24, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="sessionIndex"
            name="Session"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            label={{ value: "Session #", position: "insideBottom", offset: -4, fontSize: 11, fill: "#64748b" }}
          />
          <YAxis
            yAxisId="score"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            label={{ value: "Avg Score", angle: -90, position: "insideLeft", fontSize: 11, fill: "#64748b" }}
          />
          {showTrust && (
            <YAxis
              yAxisId="trust"
              orientation="right"
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              label={{ value: "Trust", angle: 90, position: "insideRight", fontSize: 11, fill: "#64748b" }}
            />
          )}
          <Tooltip
            contentStyle={{ background: "#1e293b", border: "1px solid #334155", fontSize: 12 }}
            labelStyle={{ color: "#94a3b8" }}
            itemStyle={{ color: "#e2e8f0" }}
            labelFormatter={(v) => `Session ${v}`}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
          <Line
            yAxisId="score"
            type="monotone"
            dataKey="score"
            name="Avg Score"
            stroke={SCORE_COLOR}
            strokeWidth={2}
            dot={(props) => {
              const { cx, cy, payload } = props as { cx: number; cy: number; payload: IndividualSessionPoint };
              return <circle key={payload.sessionIndex} cx={cx} cy={cy} r={5} fill={payload.color} stroke="#0f172a" strokeWidth={1.5} />;
            }}
            isAnimationActive={false}
          />
          {showTrust && (
            <Line
              yAxisId="trust"
              type="monotone"
              dataKey="trust"
              name="Trust Rating"
              stroke={TRUST_COLOR}
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={{ fill: TRUST_COLOR, r: 4 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          )}
          {/* Invisible scatter layer just to drive the condition-colored tooltip dots */}
          <Scatter yAxisId="score" dataKey="score" name="Condition" isAnimationActive={false} legendType="none">
            {points.map((p) => (
              <Cell key={p.sessionIndex} fill={p.color} />
            ))}
          </Scatter>
        </ComposedChart>
      </ResponsiveContainer>
      <p style={{ fontSize: 11, color: "#64748b", marginTop: -4 }}>
        Score line dots are colored by AI condition. {showTrust ? "Dashed line = trust rating (right axis)." : "Load survey CSV and select a trust question to overlay trust."}
      </p>
    </ChartCard>
  );
}
