import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { countByCondition } from "../../utils/stats";
import type { ParsedGameSession } from "../../loaders/loadData";
import { ChartCard } from "../ChartCard";

interface Props {
  sessions: ParsedGameSession[];
}

const tooltipStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 6,
  padding: "8px 12px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  fontSize: 12,
  color: "#374151",
};

export function ConditionDistribution({ sessions }: Props) {
  const data = countByCondition(sessions);

  return (
    <ChartCard title="Sessions by AI Condition">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 48 }}>
          <CartesianGrid horizontal={true} vertical={false} stroke="#e5e7eb" strokeDasharray="none" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#374151", fontSize: 11 }}
            angle={-35}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#374151", fontSize: 11 }}
          />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f9fafb" }} />
          <Bar dataKey="sessions" radius={[0, 0, 0, 0]} isAnimationActive={false} fillOpacity={1}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
