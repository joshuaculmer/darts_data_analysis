// All colors in this file must follow PALETTE.md at the project root.
import {
  ComposedChart,
  Scatter,
  Cell,
  ErrorBar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { VariableConditionStats } from "../../utils/variables";
import { ChartCard } from "../ChartCard";

interface Props {
  stats: VariableConditionStats[];
  title: string;
  /** Axis/label name for the value (e.g. "Score / Hit"). */
  valueLabel: string;
  /** Formats a numeric value for ticks/tooltips. */
  format?: (v: number) => string;
}

const TOOLTIP_STYLE = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 6,
  padding: "8px 12px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  fontSize: 12,
};

/**
 * Generic "variable mean ± 95% CI by AI condition" dot chart. Used for the
 * continuous game-derived variables on the group pages (scorePerHit, dispersion,
 * evGap, proximities), where the value is unbounded (unlike Likert 1–5).
 */
export function VariableByCondition({ stats, title, valueLabel, format = (v) => v.toFixed(2) }: Props) {
  const data = stats.map((s) => ({
    condition: s.label,
    mean: s.count > 0 ? s.mean : null,
    ci95: [s.ci95, s.ci95] as [number, number],
    ci95Raw: s.ci95,
    color: s.color,
    count: s.count,
  }));

  return (
    <ChartCard title={title}>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 16, right: 24, left: 0, bottom: 8 }} aria-label={`Mean ${valueLabel} by AI condition`}>
          <CartesianGrid horizontal vertical={false} stroke="#e5e7eb" />
          <XAxis dataKey="condition" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#374151" }} />
          <YAxis
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => format(Number(v))}
            tick={{ fontSize: 11, fill: "#374151" }}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: "#111827", fontWeight: 600 }}
            itemStyle={{ color: "#374151" }}
            formatter={(value, _name, item) => {
              if (typeof value !== "number") return ["N/A", `Mean ${valueLabel}`];
              const payload = item.payload as (typeof data)[0] | undefined;
              const count = payload?.count ?? 0;
              const ci95 = payload?.ci95Raw ?? 0;
              return [`${format(value)} (n=${count}, CI95 ±${ci95.toFixed(2)})`, `Mean ${valueLabel}`];
            }}
          />
          <Scatter dataKey="mean" isAnimationActive={false}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} fillOpacity={entry.count === 0 ? 0.25 : 1} stroke="#ffffff" strokeWidth={1} />
            ))}
            <ErrorBar dataKey="ci95" width={4} strokeWidth={1.5} stroke="#374151" />
          </Scatter>
        </ComposedChart>
      </ResponsiveContainer>
      <p style={{ fontSize: 11, color: "#6b7280", marginTop: -4 }}>
        Dots show the mean {valueLabel} per condition; error bars are the 95% confidence interval.
      </p>
    </ChartCard>
  );
}
