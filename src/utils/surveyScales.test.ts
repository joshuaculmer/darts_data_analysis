import { describe, it, expect } from "vitest";
import {
  formatLikertValue,
  inferLikertScaleFromQuestionId,
  formatScaleValue,
  getDimension,
  getScaleLabels,
  ORDINAL_SCALES,
  SURVEY_DIMENSIONS,
  AGREEMENT_LABELS,
  LUCK_LABELS,
} from "./surveyScales";

describe("ORDINAL_SCALES", () => {
  it("maps the agreement scale 1..5", () => {
    expect(ORDINAL_SCALES["strongly disagree"]).toBe(1);
    expect(ORDINAL_SCALES["neutral"]).toBe(3);
    expect(ORDINAL_SCALES["strongly agree"]).toBe(5);
  });

  it("maps the luck scale 1..5 (new instrument)", () => {
    expect(ORDINAL_SCALES["very unlucky"]).toBe(1);
    expect(ORDINAL_SCALES["unlucky"]).toBe(2);
    expect(ORDINAL_SCALES["little or no impact"]).toBe(3);
    expect(ORDINAL_SCALES["lucky"]).toBe(4);
    expect(ORDINAL_SCALES["very lucky"]).toBe(5);
  });

  it("no longer carries the retired performance scale", () => {
    expect(ORDINAL_SCALES["very poor"]).toBeUndefined();
    expect(ORDINAL_SCALES["very good"]).toBeUndefined();
  });
});

describe("SURVEY_DIMENSIONS registry", () => {
  it("groups the four instrument dimensions correctly", () => {
    expect(SURVEY_DIMENSIONS.trust.group).toBe("trust");
    expect(SURVEY_DIMENSIONS.influence.group).toBe("trust");
    expect(SURVEY_DIMENSIONS.satisfied.group).toBe("performance");
    expect(SURVEY_DIMENSIONS.luck.group).toBe("luck");
  });

  it("assigns the agreement scale to agreement questions and luck scale to luck", () => {
    expect(SURVEY_DIMENSIONS.trust.scaleLabels).toBe(AGREEMENT_LABELS);
    expect(SURVEY_DIMENSIONS.influence.scaleLabels).toBe(AGREEMENT_LABELS);
    expect(SURVEY_DIMENSIONS.satisfied.scaleLabels).toBe(AGREEMENT_LABELS);
    expect(SURVEY_DIMENSIONS.luck.scaleLabels).toBe(LUCK_LABELS);
  });

  it("getDimension returns null for unknown / nullish ids", () => {
    expect(getDimension(null)).toBeNull();
    expect(getDimension(undefined)).toBeNull();
    expect(getDimension("not_a_question")).toBeNull();
    expect(getDimension("luck")?.label).toBe("Luck");
  });

  it("getScaleLabels falls back to the agreement scale for unknown ids", () => {
    expect(getScaleLabels("luck")[5]).toBe("Very Lucky");
    expect(getScaleLabels("trust")[1]).toBe("Strongly Disagree");
    expect(getScaleLabels("unknown")).toBe(AGREEMENT_LABELS);
  });
});

describe("formatScaleValue", () => {
  it("formats integer values with the supplied label map", () => {
    expect(formatScaleValue(1, LUCK_LABELS)).toBe("Very Unlucky");
    expect(formatScaleValue(3, LUCK_LABELS)).toBe("Little or no impact");
    expect(formatScaleValue(5, AGREEMENT_LABELS)).toBe("Strongly Agree");
  });

  it("formats non-integer values as a between-label range", () => {
    expect(formatScaleValue(3.6, LUCK_LABELS)).toBe("Little or no impact to Lucky");
    expect(formatScaleValue(2.2, AGREEMENT_LABELS)).toBe("Disagree to Neutral");
  });
});

// --- deprecated shims (removed in Phase 5/6); kept green until consumers migrate ---
describe("deprecated trust/performance shims", () => {
  it("formatLikertValue still maps trust + performance labels", () => {
    expect(formatLikertValue(1, "trust")).toBe("Strongly Disagree");
    expect(formatLikertValue(1, "performance")).toBe("Very Poor");
    expect(formatLikertValue(3.6, "performance")).toBe("Average to Good");
  });

  it("inferLikertScaleFromQuestionId still distinguishes performance ids", () => {
    expect(inferLikertScaleFromQuestionId("post_session_performance_rating")).toBe("performance");
    expect(inferLikertScaleFromQuestionId("trust")).toBe("trust");
    expect(inferLikertScaleFromQuestionId(null)).toBe("trust");
  });
});
