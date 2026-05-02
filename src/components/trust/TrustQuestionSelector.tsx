import type { ParsedSurveyResponse } from "../../loaders/loadData";
import { inferLikertScaleFromQuestionId } from "../../utils/surveyScales";

interface Props {
  surveys: ParsedSurveyResponse[];
  trustQuestionId: string | null;
  onChange: (id: string) => void;
}

export function TrustQuestionSelector({ surveys, trustQuestionId, onChange }: Props) {
  const questionIds = Array.from(
    new Set(surveys.flatMap((s) => s.responses.map((r) => r.questionId))),
  ).sort();
  const trustQuestionIds = questionIds.filter(
    (id) => inferLikertScaleFromQuestionId(id) === "trust",
  );
  const performanceQuestionIds = questionIds.filter(
    (id) => inferLikertScaleFromQuestionId(id) === "performance",
  );
  const activeScale = inferLikertScaleFromQuestionId(trustQuestionId);
  const switchScale = (nextScale: "trust" | "performance") => {
    const nextIds = nextScale === "performance" ? performanceQuestionIds : trustQuestionIds;
    if (nextIds.length > 0) {
      onChange(nextIds[0]);
    }
  };

  if (questionIds.length === 0) {
    return (
      <p style={{ fontSize: 13, color: "#475569" }}>
        No survey responses found — load the survey CSV first.
      </p>
    );
  }

  return (
    <div className="trust-selector">
      <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", margin: "-0.25rem -0.25rem 0.25rem" }}>
        <button
          type="button"
          onClick={() => switchScale("trust")}
          disabled={trustQuestionIds.length === 0}
          className={`nav-tab${activeScale === "trust" ? " nav-tab--active" : ""}`}
          style={{ opacity: trustQuestionIds.length === 0 ? 0.45 : 1 }}
        >
          Trust
        </button>
        <button
          type="button"
          onClick={() => switchScale("performance")}
          disabled={performanceQuestionIds.length === 0}
          className={`nav-tab${activeScale === "performance" ? " nav-tab--active" : ""}`}
          style={{ opacity: performanceQuestionIds.length === 0 ? 0.45 : 1 }}
        >
          Performance Perception
        </button>
      </div>
      <p className="trust-selector__hint">
        </p>
    </div>
  );
}
