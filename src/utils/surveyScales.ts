/**
 * All known ordinal scale labels → numeric scores.
 *
 * Update this file as the survey instrument evolves. Keys are lowercase;
 * getAnswerValue applies .toLowerCase() before lookup so capitalisation
 * in the stored data does not matter.
 *
 * Scores within each scale are arbitrary ordinal positions — only relative
 * order matters, not the absolute numbers.
 */
export const ORDINAL_SCALES: Record<string, number> = {
  // 5-point agreement (standard Likert)
  "strongly disagree": 1,
  "disagree": 2,
  "neutral": 3,
  "neither agree nor disagree": 3,
  "agree": 4,
  "strongly agree": 5,

  // 5-point performance scale
  "very poor": 1,
  "poor": 2,
  "average": 3,
  "good": 4,
  "very good": 5,
};

export type LikertScale = "trust" | "performance";

export const TRUST_LIKERT_LABELS: Record<number, string> = {
  1: "Strongly Disagree",
  2: "Disagree",
  3: "Neutral",
  4: "Agree",
  5: "Strongly Agree",
};

export const PERFORMANCE_LIKERT_LABELS: Record<number, string> = {
  1: "Very Poor",
  2: "Poor",
  3: "Average",
  4: "Good",
  5: "Very Good",
};

export const LIKERT_TICKS = [1, 2, 3, 4, 5] as const;

export function inferLikertScaleFromQuestionId(questionId: string | null): LikertScale {
  if (!questionId) return "trust";
  return questionId.toLowerCase().includes("perform") ? "performance" : "trust";
}

function labelsFor(scale: LikertScale): Record<number, string> {
  return scale === "performance" ? PERFORMANCE_LIKERT_LABELS : TRUST_LIKERT_LABELS;
}

export function formatLikertValue(value: number, scale: LikertScale): string {
  const labels = labelsFor(scale);
  const rounded = Math.round(value);
  if (Math.abs(value - rounded) < 1e-9 && labels[rounded]) return labels[rounded];

  const low = Math.max(1, Math.min(5, Math.floor(value)));
  const high = Math.max(1, Math.min(5, Math.ceil(value)));
  if (low === high) return labels[low] ?? value.toFixed(2);
  return `${labels[low] ?? low} to ${labels[high] ?? high}`;
}
