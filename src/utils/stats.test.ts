import { describe, it, expect } from "vitest";
import { AI_Type } from "../types/dart";
import { computeKpis, groupSessionsByDate, countByCondition, MIN_SESSIONS_REQUIRED } from "./stats";
import type { ParsedGameSession, ParsedSurveyResponse } from "../loaders/loadData";

// Minimal session factory — only fill in what each test needs
function makeSession(overrides: Partial<ParsedGameSession>): ParsedGameSession {
  return {
    id: "test-id",
    created_at: "2024-01-15T10:00:00Z",
    user_uuid: "uuid-a",
    user_nickname: "Alice",
    execution_skill: 0,
    games_played: 0,
    ai_advice: AI_Type.NONE,
    games: [],
    ...overrides,
  };
}

function makeSurvey(uuid: string, overrides: Partial<ParsedSurveyResponse> = {}): ParsedSurveyResponse {
  return { id: "sv1", created_at: "2024-01-15T10:30:00Z", user_uuid: uuid, user_nickname: null, responses: [], ...overrides };
}

function makeSessions(uuid: string, n: number): ParsedGameSession[] {
  return Array.from({ length: n }, (_, i) =>
    makeSession({ user_uuid: uuid, created_at: `2024-01-${String(i + 1).padStart(2, "0")}T10:00:00Z` }),
  );
}

function makeSurveys(uuid: string, n: number): ParsedSurveyResponse[] {
  return Array.from({ length: n }, () => makeSurvey(uuid));
}

// ---------------------------------------------------------------------------
// computeKpis
// ---------------------------------------------------------------------------
describe("computeKpis", () => {
  it("returns zeros for an empty session list", () => {
    const result = computeKpis([], []);
    expect(result.uniqueParticipants).toBe(0);
    expect(result.completeParticipants).toBe(0);
    expect(result.avgSessionsPerParticipant).toBe(0);
    expect(result.avgTimePerSessionMs).toBe(0);
    expect(result.avgTotalTimeMs).toBe(0);
  });

  it("counts unique participants by user_uuid, not by nickname", () => {
    const sessions = [
      makeSession({ user_uuid: "uuid-a", user_nickname: "Alice" }),
      makeSession({ user_uuid: "uuid-a", user_nickname: "Alice" }),
      makeSession({ user_uuid: "uuid-b", user_nickname: null }),
    ];
    expect(computeKpis(sessions, []).uniqueParticipants).toBe(2);
  });

  it("does not conflate different users who share a nickname", () => {
    const sessions = [
      makeSession({ user_uuid: "uuid-a", user_nickname: "Sam" }),
      makeSession({ user_uuid: "uuid-b", user_nickname: "Sam" }),
    ];
    expect(computeKpis(sessions, []).uniqueParticipants).toBe(2);
  });

  it("computes avgSessionsPerParticipant correctly", () => {
    const sessions = [
      ...makeSessions("uuid-a", 3),
      ...makeSessions("uuid-b", 1),
    ];
    // (3 + 1) / 2 participants = 2
    expect(computeKpis(sessions, []).avgSessionsPerParticipant).toBeCloseTo(2);
  });

  it("marks a participant as complete when sessions and surveys both equal MIN_SESSIONS_REQUIRED", () => {
    const n = MIN_SESSIONS_REQUIRED;
    const sessions = makeSessions("uuid-a", n);
    const surveys = makeSurveys("uuid-a", n);
    expect(computeKpis(sessions, surveys).completeParticipants).toBe(1);
  });

  it("does not mark a participant as complete if survey count is below threshold", () => {
    const n = MIN_SESSIONS_REQUIRED;
    const sessions = makeSessions("uuid-a", n);
    const surveys = makeSurveys("uuid-a", n - 1);
    expect(computeKpis(sessions, surveys).completeParticipants).toBe(0);
  });

  it("does not mark a participant as complete if session count is below threshold", () => {
    const n = MIN_SESSIONS_REQUIRED;
    const sessions = makeSessions("uuid-a", n - 1);
    const surveys = makeSurveys("uuid-a", n);
    expect(computeKpis(sessions, surveys).completeParticipants).toBe(0);
  });

  it("computes avg time per session for complete participants using inter-session gaps", () => {
    const n = MIN_SESSIONS_REQUIRED;
    // Sessions spaced exactly 1 hour apart → gaps all 3600000ms
    const sessions = Array.from({ length: n }, (_, i) =>
      makeSession({ user_uuid: "uuid-a", created_at: `2024-01-01T${String(i).padStart(2, "0")}:00:00Z` }),
    );
    const surveys = makeSurveys("uuid-a", n);
    const { avgTimePerSessionMs } = computeKpis(sessions, surveys);
    expect(avgTimePerSessionMs).toBeCloseTo(3_600_000);
  });
});

// ---------------------------------------------------------------------------
// groupSessionsByDate
// ---------------------------------------------------------------------------
describe("groupSessionsByDate", () => {
  it("returns an empty array for no sessions", () => {
    expect(groupSessionsByDate([])).toEqual([]);
  });

  it("groups sessions that fall on the same calendar date", () => {
    const sessions = [
      makeSession({ created_at: "2024-03-01T09:00:00Z" }),
      makeSession({ created_at: "2024-03-01T17:30:00Z" }),
      makeSession({ created_at: "2024-03-02T11:00:00Z" }),
    ];
    const result = groupSessionsByDate(sessions);
    expect(result).toHaveLength(2);
    expect(result.find((d) => d.date === "2024-03-01")?.count).toBe(2);
    expect(result.find((d) => d.date === "2024-03-02")?.count).toBe(1);
  });

  it("sorts dates chronologically", () => {
    const sessions = [
      makeSession({ created_at: "2024-03-10T00:00:00Z" }),
      makeSession({ created_at: "2024-01-05T00:00:00Z" }),
      makeSession({ created_at: "2024-06-20T00:00:00Z" }),
    ];
    const dates = groupSessionsByDate(sessions).map((d) => d.date);
    expect(dates).toEqual(["2024-01-05", "2024-03-10", "2024-06-20"]);
  });

  it("uses the YYYY-MM-DD portion of created_at only", () => {
    const sessions = [
      makeSession({ created_at: "2024-05-15T23:59:59Z" }),
      makeSession({ created_at: "2024-05-15T00:00:01Z" }),
    ];
    const result = groupSessionsByDate(sessions);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2024-05-15");
    expect(result[0].count).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// countByCondition
// ---------------------------------------------------------------------------
describe("countByCondition", () => {
  it("always returns an entry for all 7 AI_Type conditions", () => {
    const result = countByCondition([]);
    expect(result).toHaveLength(7);
  });

  it("returns zero counts for conditions with no sessions", () => {
    const result = countByCondition([]);
    result.forEach((entry) => expect(entry.sessions).toBe(0));
  });

  it("correctly counts sessions per condition", () => {
    const sessions = [
      makeSession({ ai_advice: AI_Type.NONE }),
      makeSession({ ai_advice: AI_Type.NONE }),
      makeSession({ ai_advice: AI_Type.CORRECT }),
      makeSession({ ai_advice: AI_Type.BAD_GOOD }),
    ];
    const result = countByCondition(sessions);
    expect(result.find((e) => e.aiType === AI_Type.NONE)?.sessions).toBe(2);
    expect(result.find((e) => e.aiType === AI_Type.CORRECT)?.sessions).toBe(1);
    expect(result.find((e) => e.aiType === AI_Type.BAD_GOOD)?.sessions).toBe(1);
    expect(result.find((e) => e.aiType === AI_Type.WRONG)?.sessions).toBe(0);
  });

  it("returns entries in AI_Type enum order (NONE first, BAD_GOOD last)", () => {
    const result = countByCondition([]);
    expect(result[0].aiType).toBe(AI_Type.NONE);
    expect(result[result.length - 1].aiType).toBe(AI_Type.BAD_GOOD);
  });

  it("each entry carries a human-readable label", () => {
    const result = countByCondition([]);
    const labels = result.map((e) => e.label);
    expect(labels).toContain("None");
    expect(labels).toContain("Good→Bad");
    expect(labels).toContain("Bad→Good");
  });
});
