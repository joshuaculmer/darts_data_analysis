import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Scatter,
} from "recharts";
import type { ConditionStats } from "../../utils/stats";

interface Props {
  stats: ConditionStats[];
}

// Renders a vertical thin line — used for whiskers (min→Q1, Q3→max)
function WhiskerBar(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
}) {
  const { x = 0, y = 0, width = 0, height = 0, fill } = props;
  const cx = x + width / 2;
  return (
    <g>
      <line x1={cx} y1={y} x2={cx} y2={y + height} stroke={fill} strokeWidth={2} />
      <line x1={cx - 6} y1={y} x2={cx + 6} y2={y} stroke={fill} strokeWidth={2} />
      <line x1={cx - 6} y1={y + height} x2={cx + 6} y2={y + height} stroke={fill} strokeWidth={2} />
    </g>
  );
}

// Renders a horizontal median line across the full bar width
function MedianBar(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
}) {
  const { x = 0, y = 0, width = 0, fill } = props;
  return <line x1={x} y1={y} x2={x + width} y2={y} stroke={fill} strokeWidth={2.5} />;
}

export function ConditionBoxPlot({ stats }: Props) {
  // Transform into stacked deltas. All values are deltas so Recharts stacks them.
  const data = stats.map((s) => ({
    condition: s.label,
    color: s.color,
    count: s.count,
    // Originals for tooltip
    _min: s.min, _q1: s.q1, _median: s.median, _q3: s.q3, _max: s.max, _mean: s.mean,
    // Stacked deltas
    invisible: s.count === 0 ? 0 : s.min,
    lowerWing: s.count === 0 ? 0 : s.q1 - s.min,
    lowerBox: s.count === 0 ? 0 : s.median - s.q1,
    medianLine: s.count === 0 ? 0 : 0.001, // tiny segment just to place the median shape
    upperBox: s.count === 0 ? 0 : s.q3 - s.median,
    upperWing: s.count === 0 ? 0 : s.max - s.q3,
    meanDot: s.mean,
  }));

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: typeof data[0] }[] }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    if (d.count === 0) return <div className="recharts-tooltip-wrapper" style={{ background: "#1e293b", border: "1px solid #334155", padding: "8px 12px", borderRadius: 6, fontSize: 12, color: "#e2e8f0" }}><p>{d.condition}: no data</p></div>;
    return (
      <div style={{ background: "#1e293b", border: "1px solid #334155", padding: "8px 12px", borderRadius: 6, fontSize: 12, color: "#e2e8f0" }}>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>{d.condition} (n={d.count})</p>
        <p>Max: {d._max.toFixed(2)}</p>
        <p>Q3: {d._q3.toFixed(2)}</p>
        <p>Median: {d._median.toFixed(2)}</p>
        <p>Mean: {d._mean.toFixed(2)}</p>
        <p>Q1: {d._q1.toFixed(2)}</p>
        <p>Min: {d._min.toFixed(2)}</p>
      </div>
    );
  };

  return (
    <div className="chart-card">
      <h2>Execution Skill Distribution by Condition</h2>
      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart data={data} margin={{ top: 16, right: 24, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="condition" tick={{ fontSize: 11, fill: "#94a3b8" }} />
          <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
          <Tooltip content={<CustomTooltip />} />
          {/* Invisible base lifts boxes to the min value */}
          <Bar dataKey="invisible" stackId="box" fill="transparent" />
          {/* Lower whisker: min → Q1 */}
          <Bar dataKey="lowerWing" stackId="box" shape={<WhiskerBar />}
            fill="#64748b" isAnimationActive={false} />
          {/* Lower box: Q1 → median */}
          <Bar dataKey="lowerBox" stackId="box"
            fill="transparent"
            stroke="#64748b"
            strokeWidth={1}
            isAnimationActive={false}
          />
          {/* Median line: rendered as a 0-height marker */}
          <Bar dataKey="medianLine" stackId="box" shape={<MedianBar fill="#f1f5f9" />}
            fill="transparent" isAnimationActive={false} />
          {/* Upper box: median → Q3 */}
          <Bar dataKey="upperBox" stackId="box"
            fill="transparent"
            stroke="#64748b"
            strokeWidth={1}
            isAnimationActive={false}
          />
          {/* Upper whisker: Q3 → max */}
          <Bar dataKey="upperWing" stackId="box" shape={<WhiskerBar />}
            fill="#64748b" isAnimationActive={false} />
          {/* Mean dot */}
          <Scatter dataKey="meanDot" fill="#f59e0b" shape="circle" />
        </ComposedChart>
      </ResponsiveContainer>
      <p style={{ fontSize: 11, color: "#64748b", marginTop: -4 }}>
        Box = Q1–Q3, line = median, dot = mean, whiskers = min/max
      </p>
    </div>
  );
}
