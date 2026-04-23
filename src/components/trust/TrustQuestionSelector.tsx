import type { ParsedSurveyResponse } from "../../loaders/loadData";

interface Props {
  surveys: ParsedSurveyResponse[];
  trustQuestionId: string | null;
  onChange: (id: string) => void;
}

export function TrustQuestionSelector({ surveys, trustQuestionId, onChange }: Props) {
  const questionIds = Array.from(
    new Set(surveys.flatMap((s) => s.responses.map((r) => r.questionId))),
  ).sort();

  if (questionIds.length === 0) {
    return (
      <p style={{ fontSize: 13, color: "#475569" }}>
        No survey responses found — load the survey CSV first.
      </p>
    );
  }

  return (
    <div className="trust-selector">
      <label className="trust-selector__label" htmlFor="trust-question-select">
        Trust question ID
      </label>
      <select
        id="trust-question-select"
        className="trust-selector__select"
        value={trustQuestionId ?? ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>— select a question —</option>
        {questionIds.map((id) => (
          <option key={id} value={id}>{id}</option>
        ))}
      </select>
      <p className="trust-selector__hint">
        Pick the question that measures trust in the AI. Charts below will use this question's numeric responses.
      </p>
    </div>
  );
}
