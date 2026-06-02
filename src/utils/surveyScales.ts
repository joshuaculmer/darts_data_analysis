/**
 * All known ordinal scale labels → numeric scores.
 *
 * Update this file as the survey instrument evolves. Keys are lowercase;
 * getAnswerValue applies .toLowerCase() (and .trim()) before lookup so
 * capitalisation/whitespace in the stored data does not matter.
 *
 * Scores within each scale are arbitrary ordinal positions — only relative
 * order matters, not the absolute numbers.
 *
 * Current instrument (post-session survey):
 *   trust / influence / satisfied — five-point agreement Likert
 *   luck                          — Very Unlucky … Very Lucky
 * The old "performance perception" scale (Very Poor … Very Good) is RETIRED.
 */
export const ORDINAL_SCALES: Record<string, number> = {
  // 5-point agreement (standard Likert) — trust, influence, satisfied
  "strongly disagree": 1,
  "disagree": 2,
  "neutral": 3,
  "neither agree nor disagree": 3,
  "agree": 4,
  "strongly agree": 5,

  // 5-point luck attribution — luck
  "very unlucky": 1,
  "unlucky": 2,
  "little or no impact": 3,
  "lucky": 4,
  "very lucky": 5,
};

export const LIKERT_TICKS = [1, 2, 3, 4, 5] as const;

/** Display labels for the agreement scale (trust / influence / satisfied). */
export const AGREEMENT_LABELS: Record<number, string> = {
  1: "Strongly Disagree",
  2: "Disagree",
  3: "Neutral",
  4: "Agree",
  5: "Strongly Agree",
};

/** Display labels for the luck attribution scale. */
export const LUCK_LABELS: Record<number, string> = {
  1: "Very Unlucky",
  2: "Unlucky",
  3: "Little or no impact",
  4: "Lucky",
  5: "Very Lucky",
};

/** Research grouping a variable belongs to. Drives the routed group pages. */
export type VariableGroup = "trust" | "performance" | "luck";

export interface SurveyDimension {
  /** questionId as stored in survey responses */
  id: string;
  /** human-readable label for chart titles/axes */
  label: string;
  group: VariableGroup;
  /** numeric score → display label for this dimension's scale */
  scaleLabels: Record<number, string>;
}

/**
 * Single source of truth for the survey instrument's dimensions, keyed by
 * questionId. Update here when the instrument changes (do not hardcode
 * questionId strings elsewhere).
 */
export const SURVEY_DIMENSIONS: Record<string, SurveyDimension> = {
  trust: { id: "trust", label: "Trust", group: "trust", scaleLabels: AGREEMENT_LABELS },
  influence: { id: "influence", label: "Influence", group: "trust", scaleLabels: AGREEMENT_LABELS },
  satisfied: { id: "satisfied", label: "Satisfaction", group: "performance", scaleLabels: AGREEMENT_LABELS },
  luck: { id: "luck", label: "Luck", group: "luck", scaleLabels: LUCK_LABELS },
};

export function getDimension(id: string | null | undefined): SurveyDimension | null {
  if (!id) return null;
  return SURVEY_DIMENSIONS[id] ?? null;
}

/** Scale labels for a questionId; falls back to the agreement scale. */
export function getScaleLabels(id: string | null | undefined): Record<number, string> {
  return getDimension(id)?.scaleLabels ?? AGREEMENT_LABELS;
}

/**
 * Format a numeric score using an explicit label map. Integer values map to a
 * single label; non-integers render as a "low to high" range so interpolated
 * means stay readable.
 */
export function formatScaleValue(value: number, scaleLabels: Record<number, string>): string {
  const rounded = Math.round(value);
  if (Math.abs(value - rounded) < 1e-9 && scaleLabels[rounded]) return scaleLabels[rounded];

  const low = Math.max(1, Math.min(5, Math.floor(value)));
  const high = Math.max(1, Math.min(5, Math.ceil(value)));
  if (low === high) return scaleLabels[low] ?? value.toFixed(2);
  return `${scaleLabels[low] ?? low} to ${scaleLabels[high] ?? high}`;
}

// ---------------------------------------------------------------------------
// DEPRECATED — the binary trust/performance scale concept.
// Retained as thin shims so existing chart components keep compiling; they are
// migrated to SURVEY_DIMENSIONS / getScaleLabels in Phase 5/6, after which this
// whole block is removed. Do not use in new code.
// ---------------------------------------------------------------------------

/** @deprecated Use {@link SurveyDimension} / {@link getScaleLabels}. */
export type LikertScale = "trust" | "performance";

/** @deprecated Use {@link AGREEMENT_LABELS}. */
export const TRUST_LIKERT_LABELS: Record<number, string> = AGREEMENT_LABELS;

/** @deprecated Retired scale; retained only for legacy component props. */
export const PERFORMANCE_LIKERT_LABELS: Record<number, string> = {
  1: "Very Poor",
  2: "Poor",
  3: "Average",
  4: "Good",
  5: "Very Good",
};

/** @deprecated Use {@link getDimension}. */
export function inferLikertScaleFromQuestionId(questionId: string | null): LikertScale {
  if (!questionId) return "trust";
  return questionId.toLowerCase().includes("perform") ? "performance" : "trust";
}

/** @deprecated Use {@link formatScaleValue} with explicit labels. */
export function formatLikertValue(value: number, scale: LikertScale): string {
  return formatScaleValue(value, scale === "performance" ? PERFORMANCE_LIKERT_LABELS : AGREEMENT_LABELS);
}
