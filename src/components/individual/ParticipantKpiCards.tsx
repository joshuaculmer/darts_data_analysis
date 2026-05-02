import type { IndividualKpis } from "../../utils/individualStats";
import { formatLikertValue, type LikertScale } from "../../utils/surveyScales";

interface Props {
  kpis: IndividualKpis;
  likertScale: LikertScale;
}

export function ParticipantKpiCards({ kpis, likertScale }: Props) {
  const cards = [
    { label: "Sessions Played", value: kpis.sessionsPlayed.toString() },
    { label: "Avg Score / Game", value: kpis.avgScore > 0 ? kpis.avgScore.toFixed(1) : "—" },
    {
      label: "Avg Trust Rating",
      value: kpis.avgTrust !== null
        ? `${formatLikertValue(kpis.avgTrust, likertScale)} (${kpis.avgTrust.toFixed(2)})`
        : "—",
    },
    { label: "Conditions Seen", value: kpis.conditionsSeen.length > 0 ? kpis.conditionsSeen.join(", ") : "—" },
  ];

  return (
    <div className="kpi-cards">
      {cards.map(({ label, value }) => (
        <div key={label} className="kpi-card">
          <span className="kpi-value" style={{ fontSize: value.length > 10 ? "1rem" : undefined }}>{value}</span>
          <span className="kpi-label">{label}</span>
        </div>
      ))}
    </div>
  );
}
