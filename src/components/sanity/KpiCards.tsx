import { computeKpis } from "../../utils/stats";
import type { ParsedGameSession, ParsedSurveyResponse } from "../../loaders/loadData";

interface Props {
  sessions: ParsedGameSession[];
  surveyResponses: ParsedSurveyResponse[];
  completeOnly: boolean;
  onToggleCompleteOnly: () => void;
}

function formatDuration(ms: number): string {
  if (ms === 0) return "—";
  const totalSeconds = Math.round(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (mins === 0) return `${secs}s`;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

export function KpiCards({ sessions, surveyResponses, completeOnly, onToggleCompleteOnly }: Props) {
  const {
    uniqueParticipants,
    completeParticipants,
    avgSessionsPerParticipant,
    avgTimePerSessionMs,
    avgTotalTimeMs,
  } = computeKpis(sessions, surveyResponses);

  const cards = [
    { label: "Unique Participants", value: uniqueParticipants },
    { label: "Complete Participants", value: completeParticipants, isCompleteCard: true },
    { label: "Avg Sessions / Participant", value: avgSessionsPerParticipant.toFixed(1) },
    { label: "Avg Time / Session", value: formatDuration(avgTimePerSessionMs) },
    { label: "Avg Total Time", value: formatDuration(avgTotalTimeMs) },
  ];

  return (
    <div className="kpi-cards">
      {cards.map((card) => (
        <div key={card.label} className="kpi-card">
          <span className="kpi-value">{card.value}</span>
          <span className="kpi-label">{card.label}</span>
          {"isCompleteCard" in card && (
            <label className="kpi-toggle">
              <input
                type="checkbox"
                checked={completeOnly}
                onChange={onToggleCompleteOnly}
              />
              <span className="kpi-toggle__label">Complete only</span>
            </label>
          )}
        </div>
      ))}
    </div>
  );
}
