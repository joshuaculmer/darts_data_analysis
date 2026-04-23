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
} from "./surveyStats";

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

  it("returns the numeric value for a matching questionId", () => {
    const responses = [{ questionId: "trust", value: 3 }];
    expect(getAnswerValue(responses, "trust")).toBe(3);
  });

  it("returns null for non-numeric answers (strings, booleans)", () => {
    const responses = [
      { questionId: "trust", value: "yes" },
      { questionId: "open", value: true },
    ];
    expect(getAnswerValue(responses, "trust")).toBeNull();
    expect(getAnswerValue(responses, "open")).toBeNull();
  });

  it("returns the first numeric match when there are multiple responses with the same id", () => {
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
    const nearSurvey = makeSurvey({ user_uuid: "uuid-a", created_at: "2024-01-15T10:05:00Z" });
    const farSurvey = makeSurvey({ user_uuid: "uuid-a", created_at: "2024-01-15T14:00:00Z" });
    const [row] = joinSessionsWithSurvey([session], [nearSurvey, farSurvey]);
    expect(row.survey?.id).toBe(nearSurvey.id);
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
});

// ---------------------------------------------------------------------------
// computeTrustByCondition
// ---------------------------------------------------------------------------
describe("computeTrustByCondition", () => {
  it("returns 7 entries even with no joined sessions", () => {
    expect(computeTrustByCondition([], "trust")).toHaveLength(7);
  });

  it("skips sessions where the trust question is missing or non-numeric", () => {
    const joined = [
      {
        session: makeSession({ ai_advice: AI_Type.NONE }),
        survey: makeSurvey({ responses: [{ questionId: "other", value: 5 }] }),
      },
    ];
    const none = computeTrustByCondition(joined, "trust").find((s) => s.aiType === AI_Type.NONE)!;
    expect(none.count).toBe(0);
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

  it("returns one point per session that has a numeric trust answer, sorted by created_at", () => {
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
    expect(result[0].date).toBe("2024-01-10");
    expect(result[0].trust).toBe(5);
    expect(result[1].date).toBe("2024-01-20");
    expect(result[1].trust).toBe(3);
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

  it("carries aiType and color through each point", () => {
    const joined = [
      {
        session: makeSession({ ai_advice: AI_Type.BAD_GOOD }),
        survey: makeSurvey({ responses: [{ questionId: "trust", value: 4 }] }),
      },
    ];
    const [point] = computeTrustOverTime(joined, "trust");
    expect(point.aiType).toBe(AI_Type.BAD_GOOD);
    expect(point.color).toBe("#06b6d4");
  });
});

// ---------------------------------------------------------------------------
// computeTrustVsScorePoints
// ---------------------------------------------------------------------------
describe("computeTrustVsScorePoints", () => {
  it("returns an empty array when there are no joined sessions", () => {
    expect(computeTrustVsScorePoints([], "trust")).toEqual([]);
  });

  it("omits sessions with no trust answer", () => {
    const joined = [{ session: makeSession(), survey: null }];
    expect(computeTrustVsScorePoints(joined, "trust")).toHaveLength(0);
  });

  it("maps trust rating and session avg score for each point", () => {
    const joined = [
      {
        session: makeSession({
          ai_advice: AI_Type.CORRECT,
          games: [{ board_id: 1, start: 501, end: 300, suggested_aiming_coord: null, actual_aiming_coord: { x: 0, y: 0 }, hits: [] }],
        }),
        survey: makeSurvey({ responses: [{ questionId: "trust", value: 4 }] }),
      },
    ];
    const [point] = computeTrustVsScorePoints(joined, "trust");
    expect(point.trust).toBe(4);
    expect(point.score).toBeCloseTo(201);
    expect(point.aiType).toBe(AI_Type.CORRECT);
  });
});
