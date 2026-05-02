import { useState } from "react";
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
import {
  LIKERT_TICKS,
  TRUST_LIKERT_LABELS,
  PERFORMANCE_LIKERT_LABELS,
  formatLikertValue,
  type LikertScale,
} from "../../utils/surveyScales";
import { ChartCard } from "../ChartCard";

interface Props {
  points: IndividualSessionPoint[];
  showTrust: boolean;
  likertScale: LikertScale;
  onPointClick?: (sessionIndex: number) => void;
}

const TRUST_COLOR = "#16a34a";
const PERFORMANCE_COLOR = "#CC79A7";
const SCORE_SWITCH_COLOR = "#1d4ed8";
const RIGHT_AXIS_BOTH_WIDTH = 60;
const RIGHT_AXIS_SINGLE_WIDTH = 60;

const TOOLTIP_STYLE = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 6,
  padding: "8px 12px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  fontSize: 12,
};

export function IndividualTimeline({ points, showTrust, likertScale, onPointClick }: Props) {
  const [showScoreMetric, setShowScoreMetric] = useState(true);
  const [showTrustMetric, setShowTrustMetric] = useState(true);
  const [showPerformanceMetric, setShowPerformanceMetric] = useState(true);

  if (points.length === 0) {
    return (
      <ChartCard title="Wholistic Individual Graph">
        <p style={{ color: "#6b7280", fontSize: 13 }}>
          No sessions found for this participant.
        </p>
      </ChartCard>
    );
  }

  const trustEnabled = showTrust && showTrustMetric;
  const performanceEnabled = showTrust && showPerformanceMetric;
  const likertAxisEnabled = trustEnabled || performanceEnabled;
  const showRightAxis = likertAxisEnabled;
  const bothLikertEnabled = trustEnabled && performanceEnabled;
  const rightAxisWidth = bothLikertEnabled ? RIGHT_AXIS_BOTH_WIDTH : RIGHT_AXIS_SINGLE_WIDTH;

  const renderLikertTick = (props: {
    x?: number | string;
    y?: number | string;
    payload?: { value?: number | string };
  }) => {
    const x = Number(props.x ?? 0);
    const y = Number(props.y ?? 0);
    const rounded = Math.round(Number(props.payload?.value ?? 0));
    const trustLabel = TRUST_LIKERT_LABELS[rounded] ?? String(rounded);
    const performanceLabel = PERFORMANCE_LIKERT_LABELS[rounded] ?? String(rounded);
    const singleLabel = trustEnabled ? trustLabel : performanceLabel;
    return (
      <text x={x} y={y} fill="#374151" fontSize={11} textAnchor="start" dominantBaseline="middle">
        {bothLikertEnabled ? (
          <>
            <tspan x={x + 2} dy="-0.45em">{trustLabel}</tspan>
            <tspan x={x + 2} dy="1.1em">{performanceLabel}</tspan>
          </>
        ) : (
          <tspan x={x + 2} dy="0.35em">{singleLabel}</tspan>
        )}
      </text>
    );
  };

  const SwitchControl = ({
    checked,
    disabled,
    onChange,
    label,
    color,
  }: {
    checked: boolean;
    disabled?: boolean;
    onChange: (checked: boolean) => void;
    label: string;
    color: string;
  }) => (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontSize: 12,
        color: disabled ? "#9ca3af" : "#374151",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={`Toggle ${label}`}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        style={{
          width: 34,
          height: 20,
          borderRadius: 999,
          border: "1px solid #d1d5db",
          background: checked ? color : "#e5e7eb",
          position: "relative",
          transition: "background-color 120ms ease",
          padding: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 1,
            left: checked ? 15 : 1,
            width: 16,
            height: 16,
            borderRadius: 999,
            background: "#ffffff",
            transition: "left 120ms ease",
          }}
        />
      </button>
    </label>
  );

  return (
    <ChartCard title="Wholistic Individual Graph">
      <div
        style={{
          display: "flex",
          gap: 16,
          alignItems: "center",
          marginBottom: 8,
          flexWrap: "wrap",
        }}
      >
        <SwitchControl
          checked={showScoreMetric}
          onChange={setShowScoreMetric}
          label="Score"
          color={SCORE_SWITCH_COLOR}
        />
        <SwitchControl
          checked={showTrustMetric}
          disabled={!showTrust}
          onChange={setShowTrustMetric}
          label="Trust"
          color={TRUST_COLOR}
        />
        <SwitchControl
          checked={showPerformanceMetric}
          disabled={!showTrust}
          onChange={setShowPerformanceMetric}
          label="Performance"
          color={PERFORMANCE_COLOR}
        />
      </div>
      {showRightAxis && (
        <p style={{ fontSize: 11, color: "#6b7280", marginTop: -2, marginBottom: 6 }}>
          {bothLikertEnabled
            ? <><strong>Right axis</strong>: Trust (top line) and Performance (bottom line)</>
            : <><strong>Right axis</strong>: {trustEnabled ? "Trust" : "Performance"} Likert scale</>}
        </p>
      )}
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart
          data={points}
          margin={{ top: 16, right: showRightAxis ? rightAxisWidth : 24, left: 0, bottom: 8 }}
          aria-label={`${likertScale} Likert trust and score over sessions`}
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
          {showScoreMetric && (
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
          )}
          {showRightAxis && (
            <YAxis
              yAxisId="trust"
              orientation="right"
              domain={[1, 5]}
              ticks={LIKERT_TICKS as unknown as number[]}
              width={rightAxisWidth}
              tick={renderLikertTick}
              axisLine={false}
              tickLine={false}
            />
          )}
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: "#111827", fontWeight: 600 }}
            itemStyle={{ color: "#374151" }}
            labelFormatter={() => ""}
            formatter={(value, name) => {
              if (name === "Trust Rating" && typeof value === "number") {
                return [formatLikertValue(value, likertScale), "Trust Rating"];
              }
              if (name === "Performance Rating" && typeof value === "number") {
                return [formatLikertValue(value, "performance"), "Performance Rating"];
              }
              return [typeof value === "number" ? value.toFixed(1) : value, name];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "#374151" }} />

          {trustEnabled && (
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
          {performanceEnabled && (
            <Line
              yAxisId="trust"
              type="monotone"
              dataKey="performance"
              name="Performance Rating"
              stroke={PERFORMANCE_COLOR}
              strokeWidth={2}
              dot={{
                fill: PERFORMANCE_COLOR,
                r: 4,
                stroke: "#ffffff",
                strokeWidth: 1,
              }}
              connectNulls={false}
              isAnimationActive={false}
            />
          )}
          {showScoreMetric && (
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
          )}
        </ComposedChart>
      </ResponsiveContainer>
      <p style={{ fontSize: 11, color: "#6b7280", marginTop: -4 }}>
        Score dots are colored by AI condition.{" "}
        {showTrust
          ? "Dashed line = trust rating, solid magenta line = performance rating (shared survey-rating axis)."
          : "Load survey CSV and select a trust question to overlay trust and performance."}
      </p>
    </ChartCard>
  );
}

