import { describe, it, expect } from "vitest";
import { AI_Type } from "../types/dart";
import type { DartGameDTO } from "../types/dart";
import type { ParsedGameSession } from "../loaders/loadData";
import {
  sessionAvgScore,
  computeScoreByCondition,
  computeScoreVsSkillPoints,
} from "./scoreStats";

function makeGame(start: number, end: number): DartGameDTO {
  return {
    board_id: 1,
    start,
    end,
    suggested_aiming_coord: null,
    actual_aiming_coord: { x: 0, y: 0 },
    hits: [],
  };
}

function makeSession(overrides: Partial<ParsedGameSession>): ParsedGameSession {
  return {
    id: "test-id",
    created_at: "2024-01-15T10:00:00Z",
    user_uuid: "uuid-a",
    user_nickname: "Alice",
    execution_skill: 50,
    games_played: 0,
    ai_advice: AI_Type.NONE,
    games: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// sessionAvgScore
// ---------------------------------------------------------------------------
describe("sessionAvgScore", () => {
  it("returns 0 for a session with no games", () => {
    expect(sessionAvgScore([])).toBe(0);
  });

  it("returns start - end for a single game", () => {
    expect(sessionAvgScore([makeGame(501, 300)])).toBe(201);
  });

  it("averages score across multiple games", () => {
    // game1: 501-300=201, game2: 501-101=400 → avg=300.5
    const games = [makeGame(501, 300), makeGame(501, 101)];
    expect(sessionAvgScore(games)).toBeCloseTo(300.5);
  });

  it("returns 0 when start equals end (no progress)", () => {
    expect(sessionAvgScore([makeGame(501, 501)])).toBe(0);
  });

  it("handles a checkout (end=0) correctly", () => {
    expect(sessionAvgScore([makeGame(501, 0)])).toBe(501);
  });
});

// ---------------------------------------------------------------------------
// computeScoreByCondition
// ---------------------------------------------------------------------------
describe("computeScoreByCondition", () => {
  it("returns an entry for all 7 AI_Type conditions even with no sessions", () => {
    expect(computeScoreByCondition([])).toHaveLength(7);
  });

  it("returns zero stats for conditions with no sessions", () => {
    const result = computeScoreByCondition([]);
    result.forEach((s) => {
      expect(s.count).toBe(0);
      expect(s.mean).toBe(0);
      expect(s.ci95).toBe(0);
    });
  });

  it("computes mean score per condition from session games", () => {
    const sessions = [
      // CORRECT: avg score = 201
      makeSession({ ai_advice: AI_Type.CORRECT, games: [makeGame(501, 300)] }),
      // NONE: avg score = 100
      makeSession({ ai_advice: AI_Type.NONE, games: [makeGame(501, 401)] }),
    ];
    const result = computeScoreByCondition(sessions);
    expect(result.find((s) => s.aiType === AI_Type.CORRECT)!.mean).toBeCloseTo(201);
    expect(result.find((s) => s.aiType === AI_Type.NONE)!.mean).toBeCloseTo(100);
  });

  it("averages across multiple sessions in the same condition", () => {
    const sessions = [
      makeSession({ ai_advice: AI_Type.BAD, games: [makeGame(501, 201)] }), // score 300
      makeSession({ ai_advice: AI_Type.BAD, games: [makeGame(501, 401)] }), // score 100
    ];
    const bad = computeScoreByCondition(sessions).find((s) => s.aiType === AI_Type.BAD)!;
    expect(bad.count).toBe(2);
    expect(bad.mean).toBeCloseTo(200);
  });

  it("sessions with no games contribute a score of 0", () => {
    const session = makeSession({ ai_advice: AI_Type.RANDOM, games: [] });
    const random = computeScoreByCondition([session]).find((s) => s.aiType === AI_Type.RANDOM)!;
    expect(random.count).toBe(1);
    expect(random.mean).toBe(0);
  });

  it("does not mix scores between conditions", () => {
    const sessions = [
      makeSession({ ai_advice: AI_Type.CORRECT, games: [makeGame(501, 0)] }),   // score 501
      makeSession({ ai_advice: AI_Type.WRONG,   games: [makeGame(501, 500)] }), // score 1
    ];
    const result = computeScoreByCondition(sessions);
    expect(result.find((s) => s.aiType === AI_Type.CORRECT)!.mean).toBe(501);
    expect(result.find((s) => s.aiType === AI_Type.WRONG)!.mean).toBe(1);
  });

  it("returns entries in AI_Type order (NONE first, BAD_GOOD last)", () => {
    const result = computeScoreByCondition([]);
    expect(result[0].aiType).toBe(AI_Type.NONE);
    expect(result[result.length - 1].aiType).toBe(AI_Type.BAD_GOOD);
  });
});

// ---------------------------------------------------------------------------
// computeScoreVsSkillPoints
// ---------------------------------------------------------------------------
describe("computeScoreVsSkillPoints", () => {
  it("returns an empty array for no sessions", () => {
    expect(computeScoreVsSkillPoints([])).toEqual([]);
  });

  it("returns one point per session", () => {
    const sessions = [
      makeSession({ games: [makeGame(501, 300)] }),
      makeSession({ games: [makeGame(501, 100)] }),
    ];
    expect(computeScoreVsSkillPoints(sessions)).toHaveLength(2);
  });

  it("maps score and executionSkill correctly", () => {
    const [point] = computeScoreVsSkillPoints([
      makeSession({ execution_skill: 75, games: [makeGame(501, 251)] }),
    ]);
    expect(point.score).toBeCloseTo(250);
    expect(point.executionSkill).toBe(75);
  });

  it("carries aiType, label, and color for each point", () => {
    const [point] = computeScoreVsSkillPoints([
      makeSession({ ai_advice: AI_Type.GOOD_BAD }),
    ]);
    expect(point.aiType).toBe(AI_Type.GOOD_BAD);
    expect(point.label).toBe("Good→Bad");
    expect(point.color).toBe("#8b5cf6");
  });
});
