import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { groupSessionsByDate } from "../../utils/stats";
import type { ParsedGameSession } from "../../loaders/loadData";

interface Props {
  sessions: ParsedGameSession[];
}

export function SessionTimeline({ sessions }: Props) {
  const data = groupSessionsByDate(sessions);

  return (
    <div className="chart-card">
      <h2>Sessions Over Time</h2>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Line type="monotone" dataKey="count" stroke="#4f8ef7" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
