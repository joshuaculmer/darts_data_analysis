import { describe, it, expect } from "vitest";
import { AI_Type } from "../types/dart";
import type { ParsedGameSession } from "../loaders/loadData";
import type { ParsedSurveyResponse } from "../loaders/loadData";
import {
  getAnswerValue,
  joinSessionsWithSurvey,
  computeTrustByCondition,
  computeTrustOverTime,
  computeTrustVsScorePoints,
  computeTrustVsTimePoints,
  computeTrustVsProximityPoints,
} from "./surveyStats";
import type { DartGameDTO } from "../types/dart";

function makeGame(overrides: Partial<DartGameDTO> = {}): DartGameDTO {
  return {
    board_id: 1,
    start: 1000,
    end: 6000, // 5 seconds
    suggested_aiming_coord: { x: 100, y: 100 },
    actual_aiming_coord: { x: 103, y: 104 }, // proximity = 5px (3-4-5 triangle)
    hits: [],
    ...overrides,
  };
}

function makeSession(overrides: Partial<ParsedGameSession> = {}): ParsedGameSession {
  return {
    id: "session-1",
    created_at: "2024-01-15T10:00:00Z",
    user_uuid: "uuid-a",
    user_nickname: "Alice",
    execution_skill: 50,
    games_played: 3,
    ai_advice: AI_Type.NONE,
    games: [],
    ...overrides,
  };
}

function makeSurvey(overrides: Partial<ParsedSurveyResponse> = {}): ParsedSurveyResponse {
  return {
    id: "survey-1",
    created_at: "2024-01-15T10:30:00Z",
    user_uuid: "uuid-a",
    user_nickname: "Alice",
    responses: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getAnswerValue
// ---------------------------------------------------------------------------
describe("getAnswerValue", () => {
  it("returns null when responses are empty", () => {
    expect(getAnswerValue([], "trust")).toBeNull();
  });

  it("returns null when the question id is not present", () => {
    const responses = [{ questionId: "satisfaction", value: 4 }];
    expect(getAnswerValue(responses, "trust")).toBeNull();
  });

  it("returns the numeric value when stored as a number", () => {
    const responses = [{ questionId: "trust", value: 3 }];
    expect(getAnswerValue(responses, "trust")).toBe(3);
  });

  it("returns a number when the value is a numeric string — covers Supabase CSV export format", () => {
    // Supabase CSV exports JSON values as strings; "5" must be treated as 5
    const responses = [{ questionId: "trust", value: "5" }];
    expect(getAnswerValue(responses, "trust")).toBe(5);
  });

  it("returns a number for decimal numeric strings", () => {
    const responses = [{ questionId: "trust", value: "3.5" }];
    expect(getAnswerValue(responses, "trust")).toBeCloseTo(3.5);
  });

  it("maps Likert labels to the 1–5 scale", () => {
    const labels: [string, number][] = [
      ["Strongly Disagree", 1],
      ["Disagree", 2],
      ["Neutral", 3],
      ["Agree", 4],
      ["Strongly Agree", 5],
    ];
    for (const [label, expected] of labels) {
      const responses = [{ questionId: "trust", value: label }];
      expect(getAnswerValue(responses, "trust"), `expected "${label}" → ${expected}`).toBe(expected);
    }
  });

  it("maps the 5-point performance scale (very poor → very good)", () => {
    const labels: [string, number][] = [
      ["very poor", 1],
      ["poor", 2],
      ["average", 3],
      ["good", 4],
      ["very good", 5],
    ];
    for (const [label, expected] of labels) {
      const responses = [{ questionId: "perf", value: label }];
      expect(getAnswerValue(responses, "perf"), `expected "${label}" → ${expected}`).toBe(expected);
    }
  });

  it("trims whitespace before mapping — real CSV has 'Strongly Disagree ' with trailing space", () => {
    const responses = [{ questionId: "trust", value: "Strongly Disagree " }];
    expect(getAnswerValue(responses, "trust")).toBe(1);
  });

  it("is case-insensitive for Likert labels", () => {
    const responses = [{ questionId: "trust", value: "STRONGLY AGREE" }];
    expect(getAnswerValue(responses, "trust")).toBe(5);
  });

  it("returns null for free-text strings not in any ordinal scale", () => {
    const responses = [{ questionId: "open", value: "it was pretty fun" }];
    expect(getAnswerValue(responses, "open")).toBeNull();
  });

  it("returns null for booleans", () => {
    const responses = [{ questionId: "open", value: true }];
    expect(getAnswerValue(responses, "open")).toBeNull();
  });

  it("returns the first match when there are multiple responses with the same id", () => {
    const responses = [
      { questionId: "trust", value: 2 },
      { questionId: "trust", value: 5 },
    ];
    expect(getAnswerValue(responses, "trust")).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// joinSessionsWithSurvey
// ---------------------------------------------------------------------------
describe("joinSessionsWithSurvey", () => {
  it("returns an empty array when sessions are empty", () => {
    expect(joinSessionsWithSurvey([], [])).toEqual([]);
  });

  it("returns one joined row per session when every session has a matching survey", () => {
    const sessions = [makeSession()];
    const surveys = [makeSurvey()];
    expect(joinSessionsWithSurvey(sessions, surveys)).toHaveLength(1);
  });

  it("matches survey to session by user_uuid and nearest created_at", () => {
    const session = makeSession({ user_uuid: "uuid-a", created_at: "2024-01-15T10:00:00Z" });
    const nearSurvey = makeSurvey({ user_uuid: "uuid-a", id: "near", created_at: "2024-01-15T10:05:00Z" });
    const farSurvey = makeSurvey({ user_uuid: "uuid-a", id: "far", created_at: "2024-01-15T14:00:00Z" });
    const [row] = joinSessionsWithSurvey([session], [nearSurvey, farSurvey]);
    expect(row.survey?.id).toBe("near");
  });

  it("does not match surveys across different users", () => {
    const session = makeSession({ user_uuid: "uuid-a" });
    const wrongUserSurvey = makeSurvey({ user_uuid: "uuid-b" });
    const [row] = joinSessionsWithSurvey([session], [wrongUserSurvey]);
    expect(row.survey).toBeNull();
  });

  it("sets survey to null when no survey exists for that user", () => {
    const [row] = joinSessionsWithSurvey([makeSession()], []);
    expect(row.survey).toBeNull();
  });

  it("carries session fields through to the joined row", () => {
    const session = makeSession({ ai_advice: AI_Type.CORRECT, execution_skill: 80 });
    const [row] = joinSessionsWithSurvey([session], []);
    expect(row.session.ai_advice).toBe(AI_Type.CORRECT);
    expect(row.session.execution_skill).toBe(80);
  });

  it("assigns each session to a survey submitted after it, not just the closest by absolute time", () => {
    // Without the after-session constraint, Session 2 (11:00) would steal Survey 1
    // (10:30, only 30 min away) instead of correctly taking Survey 2 (12:00).
    // The fix: only consider surveys where created_at >= session created_at.
    const s1 = makeSession({ id: "s1", created_at: "2024-01-15T10:00:00Z" });
    const s2 = makeSession({ id: "s2", created_at: "2024-01-15T11:00:00Z" });
    const sv1 = makeSurvey({ id: "sv1", created_at: "2024-01-15T10:30:00Z" }); // after s1, before s2
    const sv2 = makeSurvey({ id: "sv2", created_at: "2024-01-15T12:00:00Z" }); // after s2

    const result = joinSessionsWithSurvey([s1, s2], [sv1, sv2]);
    expect(result[0].survey?.id).toBe("sv1"); // Session 1 → Survey 1 (nearest after 10:00)
    expect(result[1].survey?.id).toBe("sv2"); // Session 2 → Survey 2 (only survey after 11:00)
  });
});

// ---------------------------------------------------------------------------
// computeTrustByCondition
// ---------------------------------------------------------------------------
describe("computeTrustByCondition", () => {
  it("returns 7 entries even with no joined sessions", () => {
    expect(computeTrustByCondition([], "trust")).toHaveLength(7);
  });

  it("skips sessions where the trust question is missing", () => {
    const joined = [
      {
        session: makeSession({ ai_advice: AI_Type.NONE }),
        survey: makeSurvey({ responses: [{ questionId: "other", value: 5 }] }),
      },
    ];
    const none = computeTrustByCondition(joined, "trust").find((s) => s.aiType === AI_Type.NONE)!;
    expect(none.count).toBe(0);
  });

  it("handles numeric string values from Supabase CSV", () => {
    const joined = [
      {
        session: makeSession({ ai_advice: AI_Type.CORRECT }),
        survey: makeSurvey({ responses: [{ questionId: "trust", value: "4" }] }),
      },
    ];
    const correct = computeTrustByCondition(joined, "trust").find((s) => s.aiType === AI_Type.CORRECT)!;
    expect(correct.count).toBe(1);
    expect(correct.mean).toBe(4);
  });

  it("computes mean trust per condition", () => {
    const joined = [
      {
        session: makeSession({ ai_advice: AI_Type.CORRECT }),
        survey: makeSurvey({ responses: [{ questionId: "trust", value: 4 }] }),
      },
      {
        session: makeSession({ ai_advice: AI_Type.CORRECT }),
        survey: makeSurvey({ responses: [{ questionId: "trust", value: 2 }] }),
      },
    ];
    const correct = computeTrustByCondition(joined, "trust").find((s) => s.aiType === AI_Type.CORRECT)!;
    expect(correct.count).toBe(2);
    expect(correct.mean).toBeCloseTo(3);
  });

  it("excludes sessions with a null survey from the count", () => {
    const joined = [
      { session: makeSession({ ai_advice: AI_Type.BAD }), survey: null },
    ];
    const bad = computeTrustByCondition(joined, "trust").find((s) => s.aiType === AI_Type.BAD)!;
    expect(bad.count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeTrustOverTime
// ---------------------------------------------------------------------------
describe("computeTrustOverTime", () => {
  it("returns an empty array when there are no joined sessions", () => {
    expect(computeTrustOverTime([], "trust")).toEqual([]);
  });

  it("numbers each participant's sessions 1, 2, 3… ordered by created_at", () => {
    const joined = [
      {
        session: makeSession({ created_at: "2024-01-20T10:00:00Z" }),
        survey: makeSurvey({ responses: [{ questionId: "trust", value: 3 }] }),
      },
      {
        session: makeSession({ created_at: "2024-01-10T10:00:00Z" }),
        survey: makeSurvey({ responses: [{ questionId: "trust", value: 5 }] }),
      },
    ];
    const result = computeTrustOverTime(joined, "trust");
    expect(result).toHaveLength(2);
    expect(result[0].sessionIndex).toBe(1);
    expect(result[0].trust).toBe(5);
    expect(result[1].sessionIndex).toBe(2);
    expect(result[1].trust).toBe(3);
  });

  it("assigns independent session indices per participant", () => {
    const joined = [
      {
        session: makeSession({ user_uuid: "uuid-a", created_at: "2024-01-10T10:00:00Z" }),
        survey: makeSurvey({ user_uuid: "uuid-a", responses: [{ questionId: "trust", value: 4 }] }),
      },
      {
        session: makeSession({ user_uuid: "uuid-b", created_at: "2024-01-11T10:00:00Z" }),
        survey: makeSurvey({ user_uuid: "uuid-b", responses: [{ questionId: "trust", value: 2 }] }),
      },
    ];
    const result = computeTrustOverTime(joined, "trust");
    expect(result).toHaveLength(2);
    // Both are each participant's first session
    expect(result.every(p => p.sessionIndex === 1)).toBe(true);
  });

  it("handles numeric string trust values", () => {
    const joined = [
      {
        session: makeSession({ created_at: "2024-01-10T10:00:00Z" }),
        survey: makeSurvey({ responses: [{ questionId: "trust", value: "4" }] }),
      },
    ];
    const result = computeTrustOverTime(joined, "trust");
    expect(result).toHaveLength(1);
    expect(result[0].trust).toBe(4);
  });

  it("omits sessions where trust answer is missing or non-numeric", () => {
    const joined = [
      { session: makeSession(), survey: null },
      {
        session: makeSession({ created_at: "2024-02-01T00:00:00Z" }),
        survey: makeSurvey({ responses: [{ questionId: "other", value: 5 }] }),
      },
    ];
    expect(computeTrustOverTime(joined, "trust")).toHaveLength(0);
  });

  it("carries aiType, color, and sessionIndex through each point", () => {
    const joined = [
      {
        session: makeSession({ ai_advice: AI_Type.BAD_GOOD }),
        survey: makeSurvey({ responses: [{ questionId: "trust", value: 4 }] }),
      },
    ];
    const [point] = computeTrustOverTime(joined, "trust");
    expect(point.aiType).toBe(AI_Type.BAD_GOOD);
    expect(point.color).toBe("#56B4E9");
    expect(point.sessionIndex).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// computeTrustVsScorePoints
// ---------------------------------------------------------------------------
describe("computeTrustVsScorePoints", () => {
  it("returns an empty array when there are no joined sessions", () => {
    expect(computeTrustVsScorePoints([], "trust", new Map())).toEqual([]);
  });

  it("omits sessions with no trust answer", () => {
    const joined = [{ session: makeSession(), survey: null }];
    expect(computeTrustVsScorePoints(joined, "trust", new Map())).toHaveLength(0);
  });

  it("maps trust rating, aiType, and session for each point", () => {
    const session = makeSession({
      ai_advice: AI_Type.CORRECT,
      games: [makeGame({ hits: [] })],
    });
    const joined = [
      {
        session,
        survey: makeSurvey({ responses: [{ questionId: "trust", value: 4 }] }),
      },
    ];
    const [point] = computeTrustVsScorePoints(joined, "trust", new Map());
    expect(point.trust).toBe(4);
    expect(point.aiType).toBe(AI_Type.CORRECT);
    expect(point.score).toBe(0); // no hits → score 0
    expect(point.session).toBe(session);
  });

  it("handles numeric string trust values", () => {
    const joined = [
      {
        session: makeSession({ ai_advice: AI_Type.WRONG }),
        survey: makeSurvey({ responses: [{ questionId: "trust", value: "2" }] }),
      },
    ];
    const [point] = computeTrustVsScorePoints(joined, "trust", new Map());
    expect(point.trust).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// computeTrustVsTimePoints
// ---------------------------------------------------------------------------
describe("computeTrustVsTimePoints", () => {
  it("returns an empty array when there are no joined sessions", () => {
    expect(computeTrustVsTimePoints([], "trust")).toEqual([]);
  });

  it("omits sessions with no games", () => {
    const joined = [
      {
        session: makeSession({ games: [] }),
        survey: makeSurvey({ responses: [{ questionId: "trust", value: 3 }] }),
      },
    ];
    expect(computeTrustVsTimePoints(joined, "trust")).toHaveLength(0);
  });

  it("omits sessions with no survey or non-numeric trust", () => {
    const joined = [
      { session: makeSession({ games: [makeGame()] }), survey: null },
    ];
    expect(computeTrustVsTimePoints(joined, "trust")).toHaveLength(0);
  });

  it("computes avg game duration from start/end timestamps (ms → seconds)", () => {
    // makeGame: start=1000, end=6000 → 5 seconds per game
    const session = makeSession({ games: [makeGame(), makeGame()] });
    const joined = [
      {
        session,
        survey: makeSurvey({ responses: [{ questionId: "trust", value: 3 }] }),
      },
    ];
    const [point] = computeTrustVsTimePoints(joined, "trust");
    expect(point.avgTimeSecs).toBeCloseTo(5);
    expect(point.trust).toBe(3);
    expect(point.session).toBe(session);
  });

  it("handles numeric string trust values", () => {
    const joined = [
      {
        session: makeSession({ games: [makeGame()] }),
        survey: makeSurvey({ responses: [{ questionId: "trust", value: "4" }] }),
      },
    ];
    const [point] = computeTrustVsTimePoints(joined, "trust");
    expect(point.trust).toBe(4);
  });

  it("clamps negative durations to 0", () => {
    // end < start would be a data error; should not produce negative seconds
    const game = makeGame({ start: 6000, end: 1000 });
    const session = makeSession({ games: [game] });
    const joined = [
      {
        session,
        survey: makeSurvey({ responses: [{ questionId: "trust", value: 3 }] }),
      },
    ];
    const [point] = computeTrustVsTimePoints(joined, "trust");
    expect(point.avgTimeSecs).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeTrustVsProximityPoints
// ---------------------------------------------------------------------------
describe("computeTrustVsProximityPoints", () => {
  it("returns an empty array when there are no joined sessions", () => {
    expect(computeTrustVsProximityPoints([], "trust")).toEqual([]);
  });

  it("omits sessions with no survey or non-numeric trust", () => {
    const joined = [
      { session: makeSession({ games: [makeGame()] }), survey: null },
    ];
    expect(computeTrustVsProximityPoints(joined, "trust")).toHaveLength(0);
  });

  it("computes avgProximity as Euclidean distance between actual and suggested aiming coord", () => {
    // makeGame: suggested={100,100}, actual={103,104} → distance = sqrt(9+16) = 5
    const session = makeSession({ games: [makeGame()] });
    const joined = [
      {
        session,
        survey: makeSurvey({ responses: [{ questionId: "trust", value: 3 }] }),
      },
    ];
    const [point] = computeTrustVsProximityPoints(joined, "trust");
    expect(point.avgProximity).toBeCloseTo(5);
    expect(point.trust).toBe(3);
    expect(point.session).toBe(session);
  });

  it("sets avgProximity to null when all games have no suggested coord (NONE condition)", () => {
    const game = makeGame({ suggested_aiming_coord: null });
    const joined = [
      {
        session: makeSession({ games: [game], ai_advice: AI_Type.NONE }),
        survey: makeSurvey({ responses: [{ questionId: "trust", value: 3 }] }),
      },
    ];
    const [point] = computeTrustVsProximityPoints(joined, "trust");
    expect(point.avgProximity).toBeNull();
  });

  it("averages only games that have a suggested coord when mixed null/non-null", () => {
    const gameWithAdvice = makeGame({
      suggested_aiming_coord: { x: 100, y: 100 },
      actual_aiming_coord: { x: 100, y: 105 }, // distance = 5
    });
    const gameNoAdvice = makeGame({ suggested_aiming_coord: null });
    const joined = [
      {
        session: makeSession({ games: [gameWithAdvice, gameNoAdvice] }),
        survey: makeSurvey({ responses: [{ questionId: "trust", value: 3 }] }),
      },
    ];
    const [point] = computeTrustVsProximityPoints(joined, "trust");
    expect(point.avgProximity).toBeCloseTo(5); // only the one with advice counts
  });

  it("handles numeric string trust values", () => {
    const joined = [
      {
        session: makeSession({ games: [makeGame()] }),
        survey: makeSurvey({ responses: [{ questionId: "trust", value: "5" }] }),
      },
    ];
    const [point] = computeTrustVsProximityPoints(joined, "trust");
    expect(point.trust).toBe(5);
  });
});
