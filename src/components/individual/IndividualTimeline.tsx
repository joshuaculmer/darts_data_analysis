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
} from "recharts";
import type { IndividualSessionPoint } from "../../utils/individualStats";
import { ChartCard } from "../ChartCard";

interface Props {
  points: IndividualSessionPoint[];
  showTrust: boolean;
  onPointClick?: (sessionIndex: number) => void;
}

const TRUST_COLOR = "#16a34a";

const TOOLTIP_STYLE = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 6,
  padding: "8px 12px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  fontSize: 12,
};

export function IndividualTimeline({ points, showTrust, onPointClick }: Props) {
  if (points.length === 0) {
    return (
      <ChartCard title="Score & Trust Over Sessions">
        <p style={{ color: "#6b7280", fontSize: 13 }}>
          No sessions found for this participant.
        </p>
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Score & Trust Over Sessions">
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart
          data={points}
          margin={{ top: 16, right: 24, left: 0, bottom: 8 }}
        >
          <CartesianGrid
            horizontal
            vertical={false}
            stroke="#e5e7eb"
            strokeDasharray="none"
          />
          <XAxis
            dataKey="sessionIndex"
            name="Session"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#374151" }}
            label={{
              value: "Session #",
              position: "insideBottom",
              offset: -4,
              fontSize: 11,
              fill: "#374151",
            }}
          />
          <YAxis
            yAxisId="score"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#374151" }}
            label={{
              value: "Avg Score",
              angle: -90,
              position: "insideLeft",
              fontSize: 11,
              fill: "#374151",
            }}
          />
          {showTrust && (
            <YAxis
              yAxisId="trust"
              orientation="right"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#374151" }}
              label={{
                value: "Trust",
                angle: 90,
                position: "insideRight",
                fontSize: 11,
                fill: "#374151",
              }}
            />
          )}
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: "#111827", fontWeight: 600 }}
            itemStyle={{ color: "#374151" }}
            labelFormatter={(v) => `Session ${v}`}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "#374151" }} />

          {showTrust && (
            <Line
              yAxisId="trust"
              type="monotone"
              dataKey="trust"
              name="Trust Rating"
              stroke={TRUST_COLOR}
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={{
                fill: TRUST_COLOR,
                r: 4,
                stroke: "#ffffff",
                strokeWidth: 1,
              }}
              connectNulls={false}
              isAnimationActive={false}
            />
          )}
          <Scatter
            yAxisId="score"
            dataKey="score"
            isAnimationActive={false}
            legendType="none"
            onClick={onPointClick ? (data) => {
              const p = data as unknown as IndividualSessionPoint;
              onPointClick(p.sessionIndex);
            } : undefined}
            shape={(shapeProps: unknown) => {
              const { cx, cy, payload } = shapeProps as { cx: number; cy: number; payload: IndividualSessionPoint };
              return (
                <circle
                  cx={cx}
                  cy={cy}
                  r={5}
                  fill={payload.color}
                  stroke="#ffffff"
                  strokeWidth={1}
                  style={onPointClick ? { cursor: "pointer" } : undefined}
                />
              );
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <p style={{ fontSize: 11, color: "#6b7280", marginTop: -4 }}>
        Score line dots are colored by AI condition.{" "}
        {showTrust
          ? "Dashed line = trust rating (right axis)."
          : "Load survey CSV and select a trust question to overlay trust."}
      </p>
    </ChartCard>
  );
}

