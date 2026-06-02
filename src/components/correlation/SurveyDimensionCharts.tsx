import { useMemo } from "react";
import type { JoinedSessionSurvey } from "../../utils/surveyStats";
import {
  computeTrustByCondition,
  computeTrustLikertByCondition,
  computeTrustBySession,
  computeTrustLikertBySession,
  computeTrustOverTime,
} from "../../utils/surveyStats";
import { getDimension, getScaleLabels } from "../../utils/surveyScales";
import { TrustByCondition } from "../trust/TrustByCondition";
import { TrustBySession } from "../trust/TrustBySession";
import { TrustOverTime } from "../trust/TrustOverTime";

interface Props {
  joined: JoinedSessionSurvey[];
  /** questionId for the survey dimension to render (trust/influence/satisfied/luck). */
  questionId: string;
}

/**
 * Renders the three per-dimension summary charts (by-condition, by-session,
 * over-time) for one survey dimension, resolving its label and scale from the
 * SURVEY_DIMENSIONS registry. Used by the Trust/Performance/Luck group pages.
 */
export function SurveyDimensionCharts({ joined, questionId }: Props) {
  const metricLabel = getDimension(questionId)?.label ?? questionId;
  const scaleLabels = getScaleLabels(questionId);

  const byCondition = useMemo(() => computeTrustByCondition(joined, questionId), [joined, questionId]);
  const likertByCondition = useMemo(() => computeTrustLikertByCondition(joined, questionId), [joined, questionId]);
  const bySession = useMemo(() => computeTrustBySession(joined, questionId), [joined, questionId]);
  const likertBySession = useMemo(() => computeTrustLikertBySession(joined, questionId), [joined, questionId]);
  const overTime = useMemo(() => computeTrustOverTime(joined, questionId), [joined, questionId]);

  return (
    <>
      <TrustByCondition stats={byCondition} likertStats={likertByCondition} metricLabel={metricLabel} scaleLabels={scaleLabels} />
      <TrustBySession stats={bySession} likertStats={likertBySession} metricLabel={metricLabel} scaleLabels={scaleLabels} />
      <TrustOverTime points={overTime} metricLabel={metricLabel} scaleLabels={scaleLabels} />
    </>
  );
}
