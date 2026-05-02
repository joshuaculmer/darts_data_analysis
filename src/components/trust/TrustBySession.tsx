// All colors in this file must follow PALETTE.md at the project root.
import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ErrorBar,
  ComposedChart,
  Scatter,
} from "recharts";
import type { TrustSessionStats, TrustSessionLikertBreakdown } from "../../utils/surveyStats";
import {
  LIKERT_TICKS,
  formatLikertValue,
  type LikertScale,
  TRUST_LIKERT_LABELS,
  PERFORMANCE_LIKERT_LABELS,
} from "../../utils/surveyScales";
import { ChartCard } from "../ChartCard";

interface Props {
  stats: TrustSessionStats[];
  likertStats: TrustSessionLikertBreakdown[];
  likertScale: LikertScale;
  graphType?: GraphType;
  onGraphTypeChange?: (next: GraphType) => void;
}

type GraphType = "dot_ci" | "median_iqr" | "stacked_likert";

const TOOLTIP_STYLE = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 6,
  padding: "8px 12px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  fontSize: 12,
};

const LIKERT_STACK_COLORS = {
  1: "#D55E00",
  2: "#E69F00",
  3: "#9ca3af",
  4: "#56B4E9",
  5: "#009E73",
} as const;

export function TrustBySession({
  stats,
  likertStats,
  likertScale,
  graphType: graphTypeProp,
  onGraphTypeChange,
}: Props) {
  const [graphTypeState, setGraphTypeState] = useState<GraphType>("dot_ci");
  const graphType = graphTypeProp ?? graphTypeState;
  const metricTitle = likertScale === "performance" ? "Performance Perception" : "Trust";
  const meanData = stats.map((s) => ({
    session: s.label,
    mean: s.count > 0 ? s.mean : null,
    ci95: s.ci95,
    ci95Bounded:
      s.count > 0 && s.mean >= 1 && s.mean <= 5
        ? [Math.max(0, Math.min(s.ci95, s.mean - 1)), Math.max(0, Math.min(s.ci95, 5 - s.mean))]
        : [0, 0],
    count: s.count,
  }));
  const medianData = stats.map((s) => ({
    session: s.label,
    median: s.count > 0 ? s.median : null,
    iqr:
      s.count > 0 && s.median >= 1 && s.median <= 5
        ? [Math.max(0, Math.min(s.median - s.q1, s.median - 1)), Math.max(0, Math.min(s.q3 - s.median, 5 - s.median))]
        : [0, 0],
    count: s.count,
    q1: s.q1,
    q3: s.q3,
  }));
  const distributionData = likertStats.map((s) => ({
    session: s.label,
    count: s.count,
    pct1: s.pct1,
    pct2: s.pct2,
    pct3: s.pct3,
    pct4: s.pct4,
    pct5: s.pct5,
    count1: s.count1,
    count2: s.count2,
    count3: s.count3,
    count4: s.count4,
    count5: s.count5,
  }));
  const likertLabels = likertScale === "performance" ? PERFORMANCE_LIKERT_LABELS : TRUST_LIKERT_LABELS;
  const stackedLegend = useMemo(
    () => (LIKERT_TICKS as unknown as number[]).map((v) => `${likertLabels[v]} (${v})`).join(", "),
    [likertLabels],
  );

  return (
    <ChartCard title={`Mean ${metricTitle} Rating by Session`}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <label style={{ fontSize: 12, color: "#374151", display: "flex", alignItems: "center", gap: 6 }}>
          Graph Type
          <select
            value={graphType}
            onChange={(e) => {
              const next = e.target.value as GraphType;
              onGraphTypeChange?.(next);
              if (!onGraphTypeChange) setGraphTypeState(next);
            }}
            style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: "3px 8px", fontSize: 12, color: "#111827", background: "#ffffff" }}
          >
            <option value="dot_ci">Dot + CI</option>
            <option value="median_iqr">Median + IQR</option>
            <option value="stacked_likert">Stacked Likert</option>
          </select>
        </label>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        {graphType === "dot_ci" ? (
          <ComposedChart data={meanData} margin={{ top: 16, right: 24, left: 0, bottom: 8 }} aria-label={`Mean ${likertScale} Likert rating by session`}>
            <CartesianGrid horizontal vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="session" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#374151" }} />
            <YAxis
              axisLine={false}
              tickLine={false}
              domain={[1, 5]}
              ticks={LIKERT_TICKS as unknown as number[]}
              tickFormatter={(v) => formatLikertValue(Number(v), likertScale)}
              tick={{ fontSize: 11, fill: "#374151" }}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelStyle={{ color: "#111827", fontWeight: 600 }}
              itemStyle={{ color: "#374151" }}
              formatter={(value, _name, item) => {
                if (typeof value !== "number") return ["N/A", `Mean ${metricTitle}`];
                const payload = (item.payload as typeof meanData[0] | undefined);
                const count = payload?.count ?? 0;
                const ci95 = payload?.ci95 ?? 0;
                return [
                  `${formatLikertValue(value, likertScale)} (${value.toFixed(2)}, n=${count}, CI95 ±${ci95.toFixed(2)})`,
                  `Mean ${metricTitle}`,
                ];
              }}
            />
            <Scatter dataKey="mean" isAnimationActive={false} fill="#0072B2" stroke="#ffffff" strokeWidth={1}>
              <ErrorBar dataKey="ci95Bounded" width={4} strokeWidth={1.5} stroke="#374151" />
            </Scatter>
          </ComposedChart>
        ) : graphType === "median_iqr" ? (
          <ComposedChart data={medianData} margin={{ top: 16, right: 24, left: 0, bottom: 8 }} aria-label={`Median ${likertScale} Likert rating by session`}>
            <CartesianGrid horizontal vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="session" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#374151" }} />
            <YAxis
              axisLine={false}
              tickLine={false}
              domain={[1, 5]}
              ticks={LIKERT_TICKS as unknown as number[]}
              tickFormatter={(v) => formatLikertValue(Number(v), likertScale)}
              tick={{ fontSize: 11, fill: "#374151" }}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelStyle={{ color: "#111827", fontWeight: 600 }}
              itemStyle={{ color: "#374151" }}
              formatter={(value, _name, item) => {
                if (typeof value !== "number") return ["N/A", `Median ${metricTitle}`];
                const payload = (item.payload as typeof medianData[0] | undefined);
                const count = payload?.count ?? 0;
                const q1 = payload?.q1 ?? 0;
                const q3 = payload?.q3 ?? 0;
                return [
                  `${formatLikertValue(value, likertScale)} (${value.toFixed(2)}, Q1=${q1.toFixed(2)}, Q3=${q3.toFixed(2)}, n=${count})`,
                  `Median ${metricTitle}`,
                ];
              }}
            />
            <Scatter dataKey="median" isAnimationActive={false} fill="#0072B2" stroke="#ffffff" strokeWidth={1}>
              <ErrorBar dataKey="iqr" width={4} strokeWidth={1.5} stroke="#374151" />
            </Scatter>
          </ComposedChart>
        ) : (
          <BarChart data={distributionData} margin={{ top: 16, right: 24, left: 0, bottom: 8 }} aria-label={`${likertScale} response distribution by session`}>
            <CartesianGrid horizontal vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="session" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#374151" }} />
            <YAxis axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: "#374151" }} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelStyle={{ color: "#111827", fontWeight: 600 }}
              itemStyle={{ color: "#374151" }}
              formatter={(value, name, item) => {
                const payload = item.payload as typeof distributionData[0];
                const likertValue = Number(String(name).replace("pct", ""));
                const count = payload?.[`count${likertValue}` as keyof typeof payload] as number | undefined;
                const pct = typeof value === "number" ? value : Number(value);
                return [`${pct.toFixed(1)}% (n=${count ?? 0})`, likertLabels[likertValue] ?? String(name)];
              }}
            />
            {(LIKERT_TICKS as unknown as number[]).map((v) => (
              <Bar key={v} dataKey={`pct${v}`} stackId="likert" isAnimationActive={false} fill={LIKERT_STACK_COLORS[v as 1 | 2 | 3 | 4 | 5]} />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
      <p style={{ fontSize: 11, color: "#6b7280", marginTop: -4 }}>
        {graphType === "dot_ci"
          ? "Error bars show 95% confidence interval and are clipped to the valid Likert range (1-5). Disclaimer: CI bars cannot extend beyond the Likert scale."
          : graphType === "median_iqr"
            ? "Error bars show interquartile range (Q1 to Q3) around the median, clipped to the valid Likert range (1-5). Session numbering is per participant (Session 1, Session 2, ...)."
            : `Stacked bars show response distribution within each session number (100% scale). Legend order: ${stackedLegend}.`}
      </p>
    </ChartCard>
  );
}
