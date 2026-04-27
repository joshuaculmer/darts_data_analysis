import { describe, it, expect } from "vitest";
import { AI_Type } from "../types/dart";
import {
  computeConditionStats,
  computeScatterPoints,
  computeUserConditionAverages,
} from "./stats";
import type { ParsedGameSession } from "../loaders/loadData";

function makeSession(overrides: Partial<ParsedGameSession>): ParsedGameSession {
  return {
    id: "test-id",
    created_at: "2024-01-15T10:00:00Z",
    user_uuid: "uuid-a",
    user_nickname: "Alice",
    execution_skill: 50,
    games_played: 5,
    ai_advice: AI_Type.NONE,
    games: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// computeConditionStats
// ---------------------------------------------------------------------------
describe("computeConditionStats", () => {
  it("returns an entry for all 7 conditions even with no sessions", () => {
    const result = computeConditionStats([]);
    expect(result).toHaveLength(7);
    result.forEach((s) => {
      expect(s.count).toBe(0);
      expect(s.mean).toBe(0);
      expect(s.stdDev).toBe(0);
      expect(s.ci95).toBe(0);
    });
  });

  it("handles a single session correctly (no spread)", () => {
    const result = computeConditionStats([
      makeSession({ ai_advice: AI_Type.CORRECT, execution_skill: 75 }),
    ]);
    const correct = result.find((s) => s.aiType === AI_Type.CORRECT)!;
    expect(correct.count).toBe(1);
    expect(correct.mean).toBe(75);
    expect(correct.min).toBe(75);
    expect(correct.max).toBe(75);
    expect(correct.median).toBe(75);
    expect(correct.q1).toBe(75);
    expect(correct.q3).toBe(75);
    expect(correct.stdDev).toBe(0);
    expect(correct.ci95).toBe(0);
  });

  it("computes mean correctly for two values", () => {
    const sessions = [
      makeSession({ ai_advice: AI_Type.NONE, execution_skill: 60 }),
      makeSession({ ai_advice: AI_Type.NONE, execution_skill: 80 }),
    ];
    const none = computeConditionStats(sessions).find((s) => s.aiType === AI_Type.NONE)!;
    expect(none.count).toBe(2);
    expect(none.mean).toBeCloseTo(70);
    expect(none.min).toBe(60);
    expect(none.max).toBe(80);
    expect(none.median).toBeCloseTo(70);
    expect(none.q1).toBe(60);
    expect(none.q3).toBe(80);
  });

  it("computes median and quartiles for 5 values", () => {
    // sorted: [10, 20, 30, 40, 50]
    const sessions = [30, 10, 50, 20, 40].map((skill) =>
      makeSession({ ai_advice: AI_Type.WRONG, execution_skill: skill }),
    );
    const wrong = computeConditionStats(sessions).find((s) => s.aiType === AI_Type.WRONG)!;
    expect(wrong.count).toBe(5);
    expect(wrong.mean).toBe(30);
    expect(wrong.median).toBe(30);
    expect(wrong.q1).toBeCloseTo(15); // median of [10, 20]
    expect(wrong.q3).toBeCloseTo(45); // median of [40, 50]
    expect(wrong.min).toBe(10);
    expect(wrong.max).toBe(50);
  });

  it("computes sample std dev correctly", () => {
    // [60, 80]: mean=70, variance=(100+100)/1=200, stdDev≈14.142
    const sessions = [
      makeSession({ ai_advice: AI_Type.BAD, execution_skill: 60 }),
      makeSession({ ai_advice: AI_Type.BAD, execution_skill: 80 }),
    ];
    const bad = computeConditionStats(sessions).find((s) => s.aiType === AI_Type.BAD)!;
    expect(bad.stdDev).toBeCloseTo(14.142, 2);
  });

  it("computes 95% CI as 1.96 * stdDev / sqrt(n)", () => {
    // [60, 80]: stdDev≈14.142, n=2 → ci95 = 1.96 * 14.142 / sqrt(2) ≈ 19.6
    const sessions = [
      makeSession({ ai_advice: AI_Type.BAD, execution_skill: 60 }),
      makeSession({ ai_advice: AI_Type.BAD, execution_skill: 80 }),
    ];
    const bad = computeConditionStats(sessions).find((s) => s.aiType === AI_Type.BAD)!;
    expect(bad.ci95).toBeCloseTo(19.6, 0);
  });

  it("does not mix sessions from different conditions", () => {
    const sessions = [
      makeSession({ ai_advice: AI_Type.NONE, execution_skill: 100 }),
      makeSession({ ai_advice: AI_Type.CORRECT, execution_skill: 10 }),
    ];
    const result = computeConditionStats(sessions);
    expect(result.find((s) => s.aiType === AI_Type.NONE)!.mean).toBe(100);
    expect(result.find((s) => s.aiType === AI_Type.CORRECT)!.mean).toBe(10);
  });

  it("returns entries in AI_Type enum order", () => {
    const result = computeConditionStats([]);
    expect(result[0].aiType).toBe(AI_Type.NONE);
    expect(result[result.length - 1].aiType).toBe(AI_Type.BAD_GOOD);
  });
});

// ---------------------------------------------------------------------------
// computeScatterPoints
// ---------------------------------------------------------------------------
describe("computeScatterPoints", () => {
  it("returns one point per session", () => {
    const sessions = [
      makeSession({ execution_skill: 60, games_played: 3 }),
      makeSession({ execution_skill: 80, games_played: 7 }),
    ];
    expect(computeScatterPoints(sessions)).toHaveLength(2);
  });

  it("maps gamesPlayed and executionSkill from the session", () => {
    const [point] = computeScatterPoints([
      makeSession({ execution_skill: 72, games_played: 9, ai_advice: AI_Type.CORRECT }),
    ]);
    expect(point.executionSkill).toBe(72);
    expect(point.gamesPlayed).toBe(9);
  });

  it("carries the correct aiType, label, and color for each point", () => {
    const [point] = computeScatterPoints([
      makeSession({ ai_advice: AI_Type.GOOD_BAD }),
    ]);
    expect(point.aiType).toBe(AI_Type.GOOD_BAD);
    expect(point.label).toBe("Good→Bad");
    expect(point.color).toBe("#009E73");
  });

  it("returns an empty array for no sessions", () => {
    expect(computeScatterPoints([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// computeUserConditionAverages
// ---------------------------------------------------------------------------
describe("computeUserConditionAverages", () => {
  it("returns an empty array for no sessions", () => {
    expect(computeUserConditionAverages([])).toEqual([]);
  });

  it("returns one row per unique user", () => {
    const sessions = [
      makeSession({ user_uuid: "uuid-a" }),
      makeSession({ user_uuid: "uuid-a" }),
      makeSession({ user_uuid: "uuid-b" }),
    ];
    expect(computeUserConditionAverages(sessions)).toHaveLength(2);
  });

  it("averages execution_skill for multiple sessions under the same condition", () => {
    const sessions = [
      makeSession({ user_uuid: "uuid-a", ai_advice: AI_Type.NONE, execution_skill: 60 }),
      makeSession({ user_uuid: "uuid-a", ai_advice: AI_Type.NONE, execution_skill: 80 }),
    ];
    const [row] = computeUserConditionAverages(sessions);
    expect(row.byCondition[AI_Type.NONE]).toBeCloseTo(70);
  });

  it("records each condition separately for a user who appears in multiple conditions", () => {
    const sessions = [
      makeSession({ user_uuid: "uuid-a", ai_advice: AI_Type.NONE, execution_skill: 50 }),
      makeSession({ user_uuid: "uuid-a", ai_advice: AI_Type.CORRECT, execution_skill: 90 }),
    ];
    const [row] = computeUserConditionAverages(sessions);
    expect(row.byCondition[AI_Type.NONE]).toBe(50);
    expect(row.byCondition[AI_Type.CORRECT]).toBe(90);
  });

  it("preserves user_nickname", () => {
    const sessions = [makeSession({ user_uuid: "uuid-a", user_nickname: "Alice" })];
    const [row] = computeUserConditionAverages(sessions);
    expect(row.user_nickname).toBe("Alice");
  });
});
