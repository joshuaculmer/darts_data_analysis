import { computeKpis } from "../../utils/stats";
import type { ParsedGameSession } from "../../loaders/loadData";

interface Props {
  sessions: ParsedGameSession[];
}

export function KpiCards({ sessions }: Props) {
  const { totalSessions, uniqueParticipants, avgSkill, avgGamesPlayed } = computeKpis(sessions);

  const cards = [
    { label: "Total Sessions", value: totalSessions },
    { label: "Unique Participants", value: uniqueParticipants },
    { label: "Avg Execution Skill", value: avgSkill.toFixed(2) },
    { label: "Avg Games / Session", value: avgGamesPlayed.toFixed(1) },
  ];

  return (
    <div className="kpi-cards">
      {cards.map((card) => (
        <div key={card.label} className="kpi-card">
          <span className="kpi-value">{card.value}</span>
          <span className="kpi-label">{card.label}</span>
        </div>
      ))}
    </div>
  );
}
