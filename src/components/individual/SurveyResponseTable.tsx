import type { ParsedGameSession, ParsedSurveyResponse } from "../../loaders/loadData";

const fmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Denver",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function toMST(ts: number): string {
  return fmt.format(new Date(ts));
}

interface Props {
  userId: string;
  surveys: ParsedSurveyResponse[];
  sessions: ParsedGameSession[];
}

export function SurveyResponseTable({ userId, surveys, sessions }: Props) {
  const mine = surveys
    .filter((s) => s.user_uuid === userId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const userSessions = sessions
    .filter((s) => s.user_uuid === userId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  if (mine.length === 0) {
    return (
      <div className="chart-card">
        <h2>Survey Responses</h2>
        <p style={{ color: "#6b7280", fontSize: 13 }}>No survey responses for this participant.</p>
      </div>
    );
  }

  const allQuestionIds = Array.from(
    new Set(mine.flatMap((s) => s.responses.map((r) => r.questionId))),
  ).sort();

  return (
    <div className="chart-card">
      <h2>Survey Responses</h2>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>First Game Start (MST)</th>
              <th>Last Game End (MST)</th>
              <th>Survey Submitted (MST)</th>
              <th>Survey Duration (s)</th>
              {allQuestionIds.map((id) => <th key={id}>{id}</th>)}
            </tr>
          </thead>
          <tbody>
            {mine.map((s, i) => {
              const session = userSessions[i];
              const games = session?.games ?? [];
              const firstStart = games.length > 0 ? games[0].start : null;
              const lastEnd = games.length > 0 ? games[games.length - 1].end : null;
              const surveyTime = new Date(s.created_at).getTime();
              const surveyDuration = lastEnd !== null
                ? Math.round((surveyTime - lastEnd) / 1000)
                : null;

              return (
                <tr key={s.id}>
                  <td>{i + 1}</td>
                  <td>{s.created_at.slice(0, 10)}</td>
                  <td>{firstStart !== null ? toMST(firstStart) : "—"}</td>
                  <td>{lastEnd !== null ? toMST(lastEnd) : "—"}</td>
                  <td>{toMST(surveyTime)}</td>
                  <td>{surveyDuration !== null ? surveyDuration : "—"}</td>
                  {allQuestionIds.map((id) => {
                    const ans = s.responses.find((r) => r.questionId === id);
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
