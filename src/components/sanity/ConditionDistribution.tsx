import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { countByCondition } from "../../utils/stats";
import type { ParsedGameSession } from "../../loaders/loadData";
import { ChartCard } from "../ChartCard";

interface Props {
  sessions: ParsedGameSession[];
}

export function ConditionDistribution({ sessions }: Props) {
  const data = countByCondition(sessions);

  return (
    <ChartCard title="Sessions by AI Condition">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="sessions" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
