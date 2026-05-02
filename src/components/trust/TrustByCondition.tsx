// All colors in this file must follow PALETTE.md at the project root.
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ErrorBar,
} from "recharts";
import type { TrustConditionStats } from "../../utils/surveyStats";
import { LIKERT_TICKS, formatLikertValue, type LikertScale } from "../../utils/surveyScales";
import { ChartCard } from "../ChartCard";

interface Props {
  stats: TrustConditionStats[];
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

export function TrustByCondition({ stats, likertScale }: Props) {
  const data = stats.map((s) => ({
    condition: s.label,
    mean: s.count > 0 ? s.mean : null,
    ci95: s.ci95,
    color: s.color,
    count: s.count,
  }));

  return (
    <ChartCard title="Mean Trust Rating by AI Condition">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 16, right: 24, left: 0, bottom: 8 }} aria-label={`Mean ${likertScale} Likert rating by AI condition`}>
          <CartesianGrid horizontal vertical={false} stroke="#e5e7eb" />
          <XAxis dataKey="condition" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#374151" }} />
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
              if (typeof value !== "number") return ["N/A", "Mean Trust"];
              const count = (item.payload as typeof data[0] | undefined)?.count ?? 0;
              return [`${formatLikertValue(value, likertScale)} (${value.toFixed(2)}, n=${count})`, "Mean Trust"];
            }}
          />
          <Bar dataKey="mean" radius={[0, 0, 0, 0]} isAnimationActive={false}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} fillOpacity={entry.count === 0 ? 0.2 : 1} />
            ))}
            <ErrorBar dataKey="ci95" width={4} strokeWidth={1.5} stroke="#374151" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p style={{ fontSize: 11, color: "#6b7280", marginTop: -4 }}>
        Error bars show 95% confidence interval. Only sessions with a numeric trust response are included.
      </p>
    </ChartCard>
  );
}
