import { describe, it, expect } from "vitest";
import { buildGameDataRows, buildRawGameSessionRows } from "./GameDataTable";
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

  it("orders rows by participant, then by game start ascending within each participant", () => {
    const game = (start: number) => ({
      board_id: 1,
      start,
      end: start + 1,
      suggested_aiming_coord: null,
      actual_aiming_coord: { x: 0, y: 0 },
      hits: [],
    });

    // Concurrent participants, sessions and games supplied out of chronological
    // order. Bob comes before Alice in input; Alice's games span two sessions.
    const sessions = [
      session({ id: "bob1", user_uuid: "u-bob", user_nickname: "Bob", games: [game(50), game(10)] }),
      session({ id: "alice-A", user_uuid: "u-alice", user_nickname: "Alice", games: [game(300), game(100)] }),
      session({ id: "alice-B", user_uuid: "u-alice", user_nickname: "Alice", games: [game(5), game(250)] }),
    ];

    const rows = buildGameDataRows(sessions);

    // Alice's games (across both sessions) come first, fully chronological by
    // start, then Bob's games chronological by start.
    expect(rows.map((r) => [r.nickname, r.start])).toEqual([
      ["Alice", 5],
      ["Alice", 100],
      ["Alice", 250],
      ["Alice", 300],
      ["Bob", 10],
      ["Bob", 50],
    ]);
  });

  it("raw game_sessions export orders sessions by participant and games by start within each session", () => {
    const game = (start: number) => ({
      board_id: 1,
      start,
      end: start + 1,
      suggested_aiming_coord: null,
      actual_aiming_coord: { x: 0, y: 0 },
      hits: [],
    });

    const sessions = [
      session({ id: "bob1", user_uuid: "u-bob", user_nickname: "Bob", games: [game(50), game(10)] }),
      session({ id: "alice-B", user_uuid: "u-alice", user_nickname: "Alice", games: [game(250), game(5)] }),
      session({ id: "alice-A", user_uuid: "u-alice", user_nickname: "Alice", games: [game(100), game(30)] }),
    ];

    const raw = buildRawGameSessionRows(sessions);

    // Alice's sessions come first, ordered by their earliest game start
    // (alice-A min=30 before alice-B min=5? no — A min=30, B min=5 → B first).
    expect(raw.map((r) => r.id)).toEqual(["alice-B", "alice-A", "bob1"]);
    // Games within each session are serialized in ascending start order.
    expect(JSON.parse(raw[0].games).map((g: { start: number }) => g.start)).toEqual([5, 250]);
    expect(JSON.parse(raw[2].games).map((g: { start: number }) => g.start)).toEqual([10, 50]);
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
