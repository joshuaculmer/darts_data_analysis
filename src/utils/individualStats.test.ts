import { describe, it, expect } from "vitest";
import { AI_Type } from "../types/dart";
import type { DartGameDTO } from "../types/dart";
import type { ParsedGameSession } from "../loaders/loadData";
import type { ParsedSurveyResponse } from "../loaders/loadData";
import type { JoinedSessionSurvey } from "./surveyStats";
import {
  getParticipantList,
  computeIndividualTimeline,
  computeIndividualKpis,
  computeGameBreakdown,
} from "./individualStats";

function makeGame(start: number, end: number): DartGameDTO {
  return { board_id: 1, start, end, suggested_aiming_coord: null, actual_aiming_coord: { x: 0, y: 0 }, hits: [] };
}

function makeSession(overrides: Partial<ParsedGameSession> = {}): ParsedGameSession {
  return {
    id: "s1",
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

function makeSurvey(overrides: Partial<ParsedSurveyResponse> = {}): ParsedSurveyResponse {
  return {
    id: "sv1",
    created_at: "2024-01-15T10:30:00Z",
    user_uuid: "uuid-a",
    user_nickname: "Alice",
    responses: [],
    ...overrides,
  };
}

function makeJoined(session: ParsedGameSession, survey: ParsedSurveyResponse | null = null): JoinedSessionSurvey {
  return { session, survey };
}

// ---------------------------------------------------------------------------
// getParticipantList
// ---------------------------------------------------------------------------
describe("getParticipantList", () => {
  it("returns an empty array for no sessions", () => {
    expect(getParticipantList([])).toEqual([]);
  });

  it("returns one entry per unique user_uuid", () => {
    const sessions = [
      makeSession({ user_uuid: "uuid-a", user_nickname: "Alice" }),
      makeSession({ user_uuid: "uuid-a", user_nickname: "Alice" }),
      makeSession({ user_uuid: "uuid-b", user_nickname: "Bob" }),
    ];
    expect(getParticipantList(sessions)).toHaveLength(2);
  });

  it("uses the most recent nickname for a user who appears multiple times", () => {
    const sessions = [
      makeSession({ user_uuid: "uuid-a", user_nickname: "Alice", created_at: "2024-01-01T00:00:00Z" }),
      makeSession({ user_uuid: "uuid-a", user_nickname: "Alice2", created_at: "2024-02-01T00:00:00Z" }),
    ];
    const list = getParticipantList(sessions);
    expect(list[0].nickname).toBe("Alice2");
  });

  it("falls back to uuid when nickname is null", () => {
    const sessions = [makeSession({ user_uuid: "uuid-x", user_nickname: null })];
    const [entry] = getParticipantList(sessions);
    expect(entry.nickname).toBe("uuid-x");
    expect(entry.uuid).toBe("uuid-x");
  });

  it("sorts entries alphabetically by display nickname", () => {
    const sessions = [
      makeSession({ user_uuid: "uuid-z", user_nickname: "Zara" }),
      makeSession({ user_uuid: "uuid-a", user_nickname: "Alice" }),
    ];
    const list = getParticipantList(sessions);
    expect(list[0].nickname).toBe("Alice");
    expect(list[1].nickname).toBe("Zara");
  });
});

// ---------------------------------------------------------------------------
// computeIndividualTimeline
// ---------------------------------------------------------------------------
describe("computeIndividualTimeline", () => {
  it("returns an empty array when user has no sessions", () => {
    const joined = [makeJoined(makeSession({ user_uuid: "uuid-b" }))];
    expect(computeIndividualTimeline(joined, "uuid-a", "trust", new Map())).toEqual([]);
  });

  it("returns one point per session for the specified user, sorted by created_at", () => {
    const joined = [
      makeJoined(makeSession({ user_uuid: "uuid-a", created_at: "2024-01-20T00:00:00Z" })),
      makeJoined(makeSession({ user_uuid: "uuid-a", created_at: "2024-01-10T00:00:00Z" })),
      makeJoined(makeSession({ user_uuid: "uuid-b", created_at: "2024-01-05T00:00:00Z" })),
    ];
    const result = computeIndividualTimeline(joined, "uuid-a", "trust", new Map());
    expect(result).toHaveLength(2);
    expect(result[0].date).toBe("2024-01-10");
    expect(result[1].date).toBe("2024-01-20");
  });

  it("assigns sequential sessionIndex starting at 1", () => {
    const joined = [
      makeJoined(makeSession({ user_uuid: "uuid-a", created_at: "2024-01-10T00:00:00Z" })),
      makeJoined(makeSession({ user_uuid: "uuid-a", created_at: "2024-01-20T00:00:00Z" })),
    ];
    const result = computeIndividualTimeline(joined, "uuid-a", "trust", new Map());
    expect(result[0].sessionIndex).toBe(1);
    expect(result[1].sessionIndex).toBe(2);
  });

  it("computes avg score from games using surface lookup", () => {
    // surface value 5 at every coordinate; one hit → score 5
    const surface = Array.from({ length: 512 }, () => Array(512).fill(5));
    const boards = new Map([[1, surface]]);
    const joined = [
      makeJoined(makeSession({ user_uuid: "uuid-a", games: [makeGame(501, 201)] })),
    ];
    const [point] = computeIndividualTimeline(joined, "uuid-a", "trust", boards);
    // makeGame produces hits: [] so score is 0 regardless of surface
    expect(point.score).toBe(0);
  });

  it("sets trust to null when no survey is present", () => {
    const joined = [makeJoined(makeSession({ user_uuid: "uuid-a" }), null)];
    const [point] = computeIndividualTimeline(joined, "uuid-a", "trust", new Map());
    expect(point.trust).toBeNull();
  });

  it("extracts trust from the matched survey response", () => {
    const survey = makeSurvey({ responses: [{ questionId: "trust", value: 4 }] });
    const joined = [makeJoined(makeSession({ user_uuid: "uuid-a" }), survey)];
    const [point] = computeIndividualTimeline(joined, "uuid-a", "trust", new Map());
    expect(point.trust).toBe(4);
  });

  it("extracts performance from matched survey responses with performance question ids", () => {
    const survey = makeSurvey({
      responses: [
        { questionId: "trust", value: 4 },
        { questionId: "post_session_performance_rating", value: "very good" },
      ],
    });
    const joined = [makeJoined(makeSession({ user_uuid: "uuid-a" }), survey)];
    const [point] = computeIndividualTimeline(joined, "uuid-a", "trust", new Map());
    expect(point.performance).toBe(5);
  });

  it("carries aiType, label, and color", () => {
    const joined = [makeJoined(makeSession({ user_uuid: "uuid-a", ai_advice: AI_Type.BAD_GOOD }))];
    const [point] = computeIndividualTimeline(joined, "uuid-a", "trust", new Map());
    expect(point.aiType).toBe(AI_Type.BAD_GOOD);
    expect(point.label).toBe("Bad→Good");
    expect(point.color).toBe("#56B4E9");
  });
});

// ---------------------------------------------------------------------------
// computeIndividualKpis
// ---------------------------------------------------------------------------
describe("computeIndividualKpis", () => {
  it("returns zero/null kpis when user has no sessions", () => {
    const kpis = computeIndividualKpis([], "uuid-a", "trust", new Map());
    expect(kpis.sessionsPlayed).toBe(0);
    expect(kpis.avgScore).toBe(0);
    expect(kpis.avgTrust).toBeNull();
    expect(kpis.conditionsSeen).toEqual([]);
  });

  it("counts sessions for this user only", () => {
    const joined = [
      makeJoined(makeSession({ user_uuid: "uuid-a" })),
      makeJoined(makeSession({ user_uuid: "uuid-a" })),
      makeJoined(makeSession({ user_uuid: "uuid-b" })),
    ];
    expect(computeIndividualKpis(joined, "uuid-a", "trust", new Map()).sessionsPlayed).toBe(2);
  });

  it("averages score across sessions using surface lookup", () => {
    // hits: [] in makeGame → score 0 per game regardless of surface
    const joined = [
      makeJoined(makeSession({ user_uuid: "uuid-a", games: [makeGame(501, 201)] })),
      makeJoined(makeSession({ user_uuid: "uuid-a", games: [makeGame(501, 301)] })),
    ];
    expect(computeIndividualKpis(joined, "uuid-a", "trust", new Map()).avgScore).toBe(0);
  });

  it("returns null avgTrust when no survey responses match the trust question", () => {
    const survey = makeSurvey({ responses: [{ questionId: "other", value: 5 }] });
    const joined = [makeJoined(makeSession({ user_uuid: "uuid-a" }), survey)];
    expect(computeIndividualKpis(joined, "uuid-a", "trust", new Map()).avgTrust).toBeNull();
  });

  it("averages trust across sessions that have a numeric response", () => {
    const joined = [
      makeJoined(makeSession({ user_uuid: "uuid-a" }), makeSurvey({ responses: [{ questionId: "trust", value: 4 }] })),
      makeJoined(makeSession({ user_uuid: "uuid-a" }), makeSurvey({ responses: [{ questionId: "trust", value: 2 }] })),
    ];
    expect(computeIndividualKpis(joined, "uuid-a", "trust", new Map()).avgTrust).toBeCloseTo(3);
  });

  it("lists unique conditions seen, in order of first exposure", () => {
    const joined = [
      makeJoined(makeSession({ user_uuid: "uuid-a", created_at: "2024-01-10T00:00:00Z", ai_advice: AI_Type.NONE })),
      makeJoined(makeSession({ user_uuid: "uuid-a", created_at: "2024-01-20T00:00:00Z", ai_advice: AI_Type.CORRECT })),
      makeJoined(makeSession({ user_uuid: "uuid-a", created_at: "2024-01-30T00:00:00Z", ai_advice: AI_Type.NONE })),
    ];
    const { conditionsSeen } = computeIndividualKpis(joined, "uuid-a", "trust", new Map());
    expect(conditionsSeen).toEqual(["None", "Correct"]);
  });
});

// ---------------------------------------------------------------------------
// computeGameBreakdown
// ---------------------------------------------------------------------------
describe("computeGameBreakdown", () => {
  it("returns an empty array for a session with no games", () => {
    expect(computeGameBreakdown(makeSession(), new Map())).toEqual([]);
  });

  it("returns one point per game", () => {
    const session = makeSession({ games: [makeGame(501, 300), makeGame(501, 100)] });
    const result = computeGameBreakdown(session, new Map());
    expect(result).toHaveLength(2);
  });

  it("scores 0 when board is not in the map", () => {
    const session = makeSession({ games: [makeGame(501, 300)] });
    const [point] = computeGameBreakdown(session, new Map());
    expect(point.score).toBe(0);
  });

  it("scores using surface lookup when board is present", () => {
    const surface = Array.from({ length: 512 }, () => Array(512).fill(7));
    const boards = new Map([[1, surface]]);
    // makeGame produces hits: [] → score 0 even with a board present
    const session = makeSession({ games: [makeGame(501, 300)] });
    const [point] = computeGameBreakdown(session, boards);
    expect(point.score).toBe(0);
  });

  it("assigns sequential gameIndex starting at 1", () => {
    const session = makeSession({ games: [makeGame(501, 400), makeGame(501, 350)] });
    const result = computeGameBreakdown(session, new Map());
    expect(result[0].gameIndex).toBe(1);
    expect(result[1].gameIndex).toBe(2);
  });
});
