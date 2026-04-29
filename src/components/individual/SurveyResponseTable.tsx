import type { JoinedSessionSurvey } from "../../utils/surveyStats";
import { AI_TYPE_COLORS, AI_TYPE_LABELS } from "../../utils/stats";

interface Props {
  userId: string;
  joined: JoinedSessionSurvey[];
}

export function SurveyResponseTable({ userId, joined }: Props) {
  const mine = joined
    .filter((j) => j.session.user_uuid === userId && j.survey !== null)
    .sort((a, b) => a.session.created_at.localeCompare(b.session.created_at));

  if (mine.length === 0) {
    return (
      <div className="chart-card">
        <h2>Survey Responses</h2>
        <p style={{ color: "#6b7280", fontSize: 13 }}>No survey responses for this participant.</p>
      </div>
    );
  }

  const allQuestionIds = Array.from(
    new Set(mine.flatMap((j) => j.survey!.responses.map((r) => r.questionId))),
  ).sort();

  return (
    <div className="chart-card">
      <h2>Survey Responses</h2>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Session</th>
              <th>Date</th>
              <th>Condition</th>
              {allQuestionIds.map((id) => <th key={id}>{id}</th>)}
            </tr>
          </thead>
          <tbody>
            {mine.map((j, i) => {
              const date = j.session.created_at.slice(0, 10);
              const aiType = j.session.ai_advice;
              return (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{date}</td>
                  <td>
                    <span className="condition-badge" style={{ background: AI_TYPE_COLORS[aiType] }}>
                      {AI_TYPE_LABELS[aiType]}
                    </span>
                  </td>
                  {allQuestionIds.map((id) => {
                    const ans = j.survey!.responses.find((r) => r.questionId === id);
                    return <td key={id}>{ans !== undefined ? String(ans.value) : "—"}</td>;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
