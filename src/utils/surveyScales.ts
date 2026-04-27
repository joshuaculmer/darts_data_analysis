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

  // 3-point performance scale
  "poor": 1,
  "good": 2,
  "great": 3,
};
