import { describe, it, expect } from "vitest";
import { AI_Type } from "../types/dart";
import { computeKpis, groupSessionsByDate, countByCondition } from "./stats";
import type { ParsedGameSession } from "../loaders/loadData";

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

// ---------------------------------------------------------------------------
// computeKpis
// ---------------------------------------------------------------------------
describe("computeKpis", () => {
  it("returns zeros for an empty session list", () => {
    const result = computeKpis([]);
    expect(result.totalSessions).toBe(0);
    expect(result.uniqueParticipants).toBe(0);
    expect(result.avgSkill).toBe(0);
    expect(result.avgGamesPlayed).toBe(0);
  });

  it("returns correct values for a single session", () => {
    const result = computeKpis([
      makeSession({ execution_skill: 80, games_played: 5, user_uuid: "uuid-a" }),
    ]);
    expect(result.totalSessions).toBe(1);
    expect(result.uniqueParticipants).toBe(1);
    expect(result.avgSkill).toBe(80);
    expect(result.avgGamesPlayed).toBe(5);
  });

  it("averages execution_skill across multiple sessions", () => {
    const sessions = [
      makeSession({ execution_skill: 60 }),
      makeSession({ execution_skill: 80 }),
      makeSession({ execution_skill: 100 }),
    ];
    expect(computeKpis(sessions).avgSkill).toBeCloseTo(80);
  });

  it("counts unique participants by user_uuid, not by nickname", () => {
    const sessions = [
      makeSession({ user_uuid: "uuid-a", user_nickname: "Alice" }),
      makeSession({ user_uuid: "uuid-a", user_nickname: "Alice" }), // same person, second session
      makeSession({ user_uuid: "uuid-b", user_nickname: null }),
    ];
    expect(computeKpis(sessions).uniqueParticipants).toBe(2);
  });

  it("does not conflate different users who share a nickname", () => {
    const sessions = [
      makeSession({ user_uuid: "uuid-a", user_nickname: "Sam" }),
      makeSession({ user_uuid: "uuid-b", user_nickname: "Sam" }),
    ];
    expect(computeKpis(sessions).uniqueParticipants).toBe(2);
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
