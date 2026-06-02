// All colors in this file must follow PALETTE.md at the project root.
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
  SURVEY_DIMENSIONS,
  DIMENSION_COLORS,
  LUCK_LABELS,
  formatScaleValue,
} from "../../utils/surveyScales";
import { ChartCard } from "../ChartCard";

interface Props {
  points: IndividualSessionPoint[];
  surveyLoaded: boolean;
  onPointClick?: (sessionIndex: number) => void;
}

const SCORE_SWITCH_COLOR = "#1d4ed8";
const RIGHT_AXIS_WIDTH = 90;

const TOOLTIP_STYLE = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 6,
  padding: "8px 12px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  fontSize: 12,
};

const DIMENSION_IDS = Object.keys(SURVEY_DIMENSIONS);

/** Series name shown in legend/tooltip for a dimension's rating line. */
const seriesName = (id: string) => `${SURVEY_DIMENSIONS[id].label} Rating`;

export function IndividualTimeline({ points, surveyLoaded, onPointClick }: Props) {
  const [showScore, setShowScore] = useState(true);
  // Default: trust overlaid, the other dimensions opt-in to avoid clutter.
  const [enabled, setEnabled] = useState<Record<string, boolean>>({
    trust: true,
  });

  if (points.length === 0) {
    return (
      <ChartCard title="Wholistic Individual Graph">
        <p style={{ color: "#6b7280", fontSize: 13 }}>
          No sessions found for this participant.
        </p>
      </ChartCard>
    );
  }

  // Which dimensions actually have at least one response across these sessions.
  const availableDims = DIMENSION_IDS.filter((id) =>
    points.some((p) => p.surveyValues[id] != null),
  );
  const enabledDims = availableDims.filter((id) => enabled[id]);
  const showRightAxis = enabledDims.length > 0;

  // Shared right-axis labels: if every enabled dimension uses the same scale,
  // render that scale's labels; otherwise fall back to numeric 1–5 ticks.
  const distinctScales = new Set(enabledDims.map((id) => SURVEY_DIMENSIONS[id].scaleLabels));
  const sharedScaleLabels = distinctScales.size === 1
    ? SURVEY_DIMENSIONS[enabledDims[0]].scaleLabels
    : null;

  const renderLikertTick = (props: {
    x?: number | string;
    y?: number | string;
    payload?: { value?: number | string };
  }) => {
    const x = Number(props.x ?? 0);
    const y = Number(props.y ?? 0);
    const rounded = Math.round(Number(props.payload?.value ?? 0));
    const label = sharedScaleLabels ? (sharedScaleLabels[rounded] ?? String(rounded)) : String(rounded);
    return (
      <text x={x + 2} y={y} fill="#374151" fontSize={11} textAnchor="start" dominantBaseline="middle">
        {label}
      </text>
    );
  };

  // name → scaleLabels, so the tooltip can format each dimension in its own scale.
  const nameToScale: Record<string, Record<number, string>> = {};
  for (const id of DIMENSION_IDS) nameToScale[seriesName(id)] = SURVEY_DIMENSIONS[id].scaleLabels;

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
          checked={showScore}
          onChange={setShowScore}
          label="Score"
          color={SCORE_SWITCH_COLOR}
        />
        {DIMENSION_IDS.map((id) => {
          const available = availableDims.includes(id);
          return (
            <SwitchControl
              key={id}
              checked={!!enabled[id] && available}
              disabled={!surveyLoaded || !available}
              onChange={(c) => setEnabled((prev) => ({ ...prev, [id]: c }))}
              label={SURVEY_DIMENSIONS[id].label}
              color={DIMENSION_COLORS[id]}
            />
          );
        })}
      </div>
      {showRightAxis && (
        <p style={{ fontSize: 11, color: "#6b7280", marginTop: -2, marginBottom: 6 }}>
          <strong>Right axis</strong>:{" "}
          {sharedScaleLabels
            ? `${enabledDims.map((id) => SURVEY_DIMENSIONS[id].label).join(", ")} (${sharedScaleLabels === LUCK_LABELS ? "luck" : "agreement"} scale)`
            : "survey rating 1–5 (mixed scales — see tooltip for labels)"}
        </p>
      )}
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart
          data={points}
          margin={{ top: 16, right: showRightAxis ? RIGHT_AXIS_WIDTH : 24, left: 0, bottom: 8 }}
          aria-label="Survey ratings and score over sessions"
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
          {showScore && (
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
              yAxisId="rating"
              orientation="right"
              domain={[1, 5]}
              ticks={LIKERT_TICKS as unknown as number[]}
              width={RIGHT_AXIS_WIDTH}
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
              const scale = typeof name === "string" ? nameToScale[name] : undefined;
              if (scale && typeof value === "number") {
                return [formatScaleValue(value, scale), name];
              }
              return [typeof value === "number" ? value.toFixed(1) : value, name];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "#374151" }} />

          {enabledDims.map((id) => (
            <Line
              key={id}
              yAxisId="rating"
              type="monotone"
              dataKey={`surveyValues.${id}`}
              name={seriesName(id)}
              stroke={DIMENSION_COLORS[id]}
              strokeWidth={2}
              dot={{
                fill: DIMENSION_COLORS[id],
                r: 4,
                stroke: "#ffffff",
                strokeWidth: 1,
              }}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
          {showScore && (
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
        {surveyLoaded
          ? "Toggle any survey dimension above to overlay its rating line (shared right-axis scale)."
          : "Load survey CSV to overlay trust, influence, satisfaction, and luck ratings."}
      </p>
    </ChartCard>
  );
}
