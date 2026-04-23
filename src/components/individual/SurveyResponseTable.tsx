import type { IndividualSessionPoint } from "../../utils/individualStats";
import type { JoinedSessionSurvey } from "../../utils/surveyStats";

interface Props {
  userId: string;
  joined: JoinedSessionSurvey[];
  points: IndividualSessionPoint[];
}

export function SurveyResponseTable({ userId, joined, points }: Props) {
  const mine = joined
    .filter((j) => j.session.user_uuid === userId && j.survey !== null)
    .sort((a, b) => a.session.created_at.localeCompare(b.session.created_at));

  if (mine.length === 0) {
    return (
      <div className="chart-card">
        <h2>Survey Responses</h2>
        <p style={{ color: "#475569", fontSize: 13 }}>No survey responses for this participant.</p>
      </div>
    );
  }

  const allQuestionIds = Array.from(
    new Set(mine.flatMap((j) => j.survey!.responses.map((r) => r.questionId))),
  ).sort();

  const sessionLookup = new Map(points.map((p) => [p.date, p]));

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
              const pt = sessionLookup.get(date);
              return (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{date}</td>
                  <td>
                    {pt && <span className="condition-badge" style={{ background: pt.color }}>{pt.label}</span>}
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
