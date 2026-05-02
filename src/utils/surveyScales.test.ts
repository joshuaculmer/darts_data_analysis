import { describe, it, expect } from "vitest";
import {
  formatLikertValue,
  inferLikertScaleFromQuestionId,
} from "./surveyScales";

describe("formatLikertValue", () => {
  it("formats trust scale labels for integer values", () => {
    expect(formatLikertValue(1, "trust")).toBe("Strongly Disagree");
    expect(formatLikertValue(3, "trust")).toBe("Neutral");
    expect(formatLikertValue(5, "trust")).toBe("Strongly Agree");
  });

  it("formats performance scale labels for integer values", () => {
    expect(formatLikertValue(1, "performance")).toBe("Very Poor");
    expect(formatLikertValue(3, "performance")).toBe("Average");
    expect(formatLikertValue(5, "performance")).toBe("Very Good");
  });

  it("formats non-integer values as a between-label range", () => {
    expect(formatLikertValue(3.6, "performance")).toBe("Average to Good");
    expect(formatLikertValue(2.2, "trust")).toBe("Disagree to Neutral");
  });
});

describe("inferLikertScaleFromQuestionId", () => {
  it("infers performance scale from question ids that mention performance", () => {
    expect(inferLikertScaleFromQuestionId("performance")).toBe("performance");
    expect(inferLikertScaleFromQuestionId("post_session_performance_rating")).toBe("performance");
  });

  it("defaults to trust scale for other question ids", () => {
    expect(inferLikertScaleFromQuestionId("trust")).toBe("trust");
    expect(inferLikertScaleFromQuestionId("ai_reliance")).toBe("trust");
    expect(inferLikertScaleFromQuestionId(null)).toBe("trust");
  });
});
