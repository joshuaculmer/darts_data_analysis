import { describe, it, expect } from "vitest";
import { AI_Type } from "../types/dart";
import { loadGameSessions, loadSurveyResponses, safeParseJSON } from "./loadData";

// ---------------------------------------------------------------------------
// safeParseJSON
// ---------------------------------------------------------------------------
describe("safeParseJSON", () => {
  it("parses valid JSON and returns the typed value", () => {
    expect(safeParseJSON<number[]>("[1,2,3]", [])).toEqual([1, 2, 3]);
  });

  it("returns the fallback for malformed JSON", () => {
    expect(safeParseJSON<number[]>("not json", [])).toEqual([]);
  });

  it("returns the fallback for an empty string", () => {
    expect(safeParseJSON<null>("", null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// loadGameSessions
// ---------------------------------------------------------------------------
describe("loadGameSessions", () => {
  const GAMES_JSON = JSON.stringify([
    {
      board_id: 1,
      start: 501,
      end: 0,
      suggested_aiming_coord: { x: 0.5, y: 0.5 },
      actual_aiming_coord: { x: 0.48, y: 0.52 },
      hits: [{ x: 0.47, y: 0.51 }],
    },
  ]);

  const CSV = [
    "id,created_at,user_uuid,user_nickname,execution_skill,games_played,ai_advice,games",
    `row-1,2024-03-01T10:00:00Z,uuid-a,Alice,75.5,10,${AI_Type.CORRECT},"${GAMES_JSON.replace(/"/g, '""')}"`,
    `row-2,2024-03-02T11:00:00Z,uuid-b,,42,3,${AI_Type.NONE},[]`,
  ].join("\n");

  it("parses the correct number of rows", async () => {
    const result = await loadGameSessions(CSV);
    expect(result).toHaveLength(2);
  });

  it("coerces execution_skill and games_played to numbers", async () => {
    const [first] = await loadGameSessions(CSV);
    expect(typeof first.execution_skill).toBe("number");
    expect(first.execution_skill).toBe(75.5);
    expect(typeof first.games_played).toBe("number");
    expect(first.games_played).toBe(10);
  });

  it("coerces ai_advice to the AI_Type enum number", async () => {
    const [first] = await loadGameSessions(CSV);
    expect(first.ai_advice).toBe(AI_Type.CORRECT);
  });

  it("parses the games JSON column into a DartGameDTO array", async () => {
    const [first] = await loadGameSessions(CSV);
    expect(Array.isArray(first.games)).toBe(true);
    expect(first.games).toHaveLength(1);
    expect(first.games[0].board_id).toBe(1);
    expect(first.games[0].start).toBe(501);
  });

  it("handles a null / empty user_nickname", async () => {
    const sessions = await loadGameSessions(CSV);
    expect(sessions[1].user_nickname).toBeNull();
  });

  it("falls back to an empty array when games column is invalid JSON", async () => {
    const badCsv = [
      "id,created_at,user_uuid,user_nickname,execution_skill,games_played,ai_advice,games",
      "row-x,2024-01-01T00:00:00Z,uuid-x,Bob,50,2,0,NOT_VALID_JSON",
    ].join("\n");
    const [session] = await loadGameSessions(badCsv);
    expect(session.games).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// loadSurveyResponses
// ---------------------------------------------------------------------------
describe("loadSurveyResponses", () => {
  const RESPONSES_JSON = JSON.stringify([
    { questionId: "trust", value: "Agree" },
    { questionId: "performance", value: "good" },
  ]);

  const CSV = [
    "id,created_at,user_uuid,user_nickname,responses",
    `resp-1,2024-03-01T12:00:00Z,uuid-a,Alice,"${RESPONSES_JSON.replace(/"/g, '""')}"`,
  ].join("\n");

  it("parses the correct number of rows", async () => {
    const result = await loadSurveyResponses(CSV);
    expect(result).toHaveLength(1);
  });

  it("parses the responses JSON column into an Answer array", async () => {
    const [resp] = await loadSurveyResponses(CSV);
    expect(resp.responses).toHaveLength(2);
    expect(resp.responses[0].questionId).toBe("trust");
    expect(resp.responses[0].value).toBe("Agree");
  });
});
