import { describe, it, expect } from "vitest";
import { buildGameDataRows } from "./GameDataTable";
import type { ParsedGameSession } from "../../loaders/loadData";
import { AI_Type } from "../../types/dart";

function session(overrides: Partial<ParsedGameSession>): ParsedGameSession {
  return {
    id: "s1",
    created_at: "2026-01-01T00:00:00Z",
    user_uuid: "u1",
    user_nickname: "Alice",
    execution_skill: 10,
    games_played: 2,
    ai_advice: AI_Type.CORRECT,
    games: [],
    ...overrides,
  };
}

describe("buildGameDataRows", () => {
  it("emits one row per game across sessions with raw game fields", () => {
    const sessions = [
      session({
        id: "s1",
        games: [
          {
            board_id: 5,
            seed: 42,
            start: 100,
            end: 200,
            suggested_aiming_coord: { x: 1, y: 2 },
            actual_aiming_coord: { x: 3, y: 4 },
            hits: [{ x: 3, y: 4 }, { x: 5, y: 6 }],
          },
        ],
      }),
      session({ id: "s2", user_uuid: "u2", games: [] }),
    ];

    const rows = buildGameDataRows(sessions);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      sessionId: "s1",
      uuid: "u1",
      gameIndex: 0,
      boardId: 5,
      suggestedX: 1,
      suggestedY: 2,
      actualX: 3,
      actualY: 4,
      hitCount: 2,
    });
  });

  it("handles null suggested aim and empty hits", () => {
    const rows = buildGameDataRows([
      session({
        games: [
          {
            board_id: 100,
            start: 0,
            end: 1,
            suggested_aiming_coord: null,
            actual_aiming_coord: { x: 0, y: 0 },
            hits: [],
          },
        ],
      }),
    ]);

    expect(rows[0].suggestedX).toBeNull();
    expect(rows[0].hitCount).toBe(0);
  });
});
