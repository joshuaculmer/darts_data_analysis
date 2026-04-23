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

interface Props {
  stats: TrustConditionStats[];
}

export function TrustByCondition({ stats }: Props) {
  const data = stats.map((s) => ({
    condition: s.label,
    mean: s.count > 0 ? s.mean : null,
    ci95: s.ci95,
    color: s.color,
    count: s.count,
  }));

  return (
    <div className="chart-card">
      <h2>Mean Trust Rating by AI Condition</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 16, right: 24, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="condition" tick={{ fontSize: 11, fill: "#94a3b8" }} />
          <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
          <Tooltip
            formatter={(value, _name, item) => {
              if (typeof value !== "number") return ["N/A", "Mean Trust"];
              const count = (item.payload as typeof data[0] | undefined)?.count ?? 0;
              return [`${value.toFixed(2)} (n=${count})`, "Mean Trust"];
            }}
            contentStyle={{ background: "#1e293b", border: "1px solid #334155", fontSize: 12 }}
            labelStyle={{ color: "#94a3b8" }}
            itemStyle={{ color: "#e2e8f0" }}
          />
          <Bar dataKey="mean" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} fillOpacity={entry.count === 0 ? 0 : 0.85} />
            ))}
            <ErrorBar dataKey="ci95" width={4} strokeWidth={2} stroke="#f1f5f9" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p style={{ fontSize: 11, color: "#64748b", marginTop: -4 }}>
        Error bars show 95% confidence interval. Only sessions with a numeric trust response are included.
      </p>
    </div>
  );
}
