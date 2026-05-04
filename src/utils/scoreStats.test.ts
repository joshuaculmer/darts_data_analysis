import { describe, it, expect } from "vitest";
import { AI_Type } from "../types/dart";
import type { DartGameDTO, RewardSurface } from "../types/dart";
import type { ParsedGameSession } from "../loaders/loadData";
import {
  gameScore,
  computeSessionScore,
  computeScoreByCondition,
  computeScoreVsSkillPoints,
  computeGameOptimalProximity,
  computeOptimalProximityVsScorePoints,
  computeProximityVsScorePoints,
} from "./scoreStats";
import { getOptimalAimingCoord } from "./aimingLookup";

function makeGame(boardId: number, hits: { x: number; y: number }[] = []): DartGameDTO {
  return {
    board_id: boardId,
    start: 0,
    end: 0,
    suggested_aiming_coord: null,
    actual_aiming_coord: { x: 0, y: 0 },
    hits,
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

function makeFlatSurface(value: number, size = 512): RewardSurface {
  return Array.from({ length: size }, () => Array(size).fill(value));
}

// ---------------------------------------------------------------------------
// gameScore
// ---------------------------------------------------------------------------
describe("gameScore", () => {
  it("returns 0 for a game with no hits", () => {
    const surface = makeFlatSurface(5);
    expect(gameScore(makeGame(0), surface)).toBe(0);
  });

  it("sums surface values at each hit coordinate", () => {
    const surface: RewardSurface = Array.from({ length: 512 }, (_, x) =>
      Array.from({ length: 512 }, (_, y) => x + y),
    );
    const hits = [{ x: 1, y: 2 }, { x: 3, y: 4 }];
    // surface[1][2] = 3, surface[3][4] = 7 → total 10
    expect(gameScore(makeGame(0, hits), surface)).toBe(10);
  });

  it("floors float coordinates before indexing", () => {
    // surface[2][3] = 5; hit at (2.9, 3.8) should floor to [2][3]
    const surface: RewardSurface = Array.from({ length: 512 }, (_, x) =>
      Array.from({ length: 512 }, (_, y) => (x === 2 && y === 3 ? 5 : 0)),
    );
    expect(gameScore(makeGame(0, [{ x: 2.9, y: 3.8 }]), surface)).toBe(5);
  });

  it("returns 0 for out-of-bounds hits", () => {
    const surface = makeFlatSurface(99, 2); // 2×2 surface
    const hits = [{ x: 100, y: 100 }];
    expect(gameScore(makeGame(0, hits), surface)).toBe(0);
  });

  it("handles a uniform surface correctly", () => {
    const surface = makeFlatSurface(3);
    const hits = [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 255, y: 255 }];
    expect(gameScore(makeGame(0, hits), surface)).toBe(9);
  });
});

// ---------------------------------------------------------------------------
// computeSessionScore
// ---------------------------------------------------------------------------
describe("computeSessionScore", () => {
  it("returns zero sum and avg for a session with no games", () => {
    const result = computeSessionScore(makeSession({ games: [] }), new Map());
    expect(result.sum).toBe(0);
    expect(result.avg).toBe(0);
    expect(result.gameScores).toEqual([]);
  });

  it("sums and averages game scores across all games in a session", () => {
    const surface = makeFlatSurface(1);
    const boards = new Map([[0, surface]]);
    const games = [
      makeGame(0, [{ x: 0, y: 0 }, { x: 0, y: 0 }]),  // score 2
      makeGame(0, [{ x: 0, y: 0 }]),                     // score 1
    ];
    const result = computeSessionScore(makeSession({ games }), boards);
    expect(result.gameScores).toEqual([2, 1]);
    expect(result.sum).toBe(3);
    expect(result.avg).toBeCloseTo(1.5);
  });

  it("scores 0 for games whose board is not in the map", () => {
    const result = computeSessionScore(
      makeSession({ games: [makeGame(99, [{ x: 0, y: 0 }])] }),
      new Map(),
    );
    expect(result.sum).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeScoreByCondition
// ---------------------------------------------------------------------------
describe("computeScoreByCondition", () => {
  it("returns an entry for all 7 AI_Type conditions even with no sessions", () => {
    expect(computeScoreByCondition([], new Map())).toHaveLength(7);
  });

  it("returns zero stats for conditions with no sessions", () => {
    computeScoreByCondition([], new Map()).forEach((s) => {
      expect(s.count).toBe(0);
      expect(s.mean).toBe(0);
    });
  });

  it("groups sessions by condition correctly", () => {
    const surface = makeFlatSurface(1);
    const boards = new Map([[0, surface]]);
    const sessions = [
      makeSession({ ai_advice: AI_Type.CORRECT, games: [makeGame(0, [{ x: 0, y: 0 }])] }),
      makeSession({ ai_advice: AI_Type.CORRECT, games: [makeGame(0, [{ x: 0, y: 0 }])] }),
      makeSession({ ai_advice: AI_Type.NONE,    games: [makeGame(0, [{ x: 0, y: 0 }, { x: 0, y: 0 }])] }),
    ];
    const result = computeScoreByCondition(sessions, boards);
    expect(result.find((s) => s.aiType === AI_Type.CORRECT)!.count).toBe(2);
    expect(result.find((s) => s.aiType === AI_Type.NONE)!.count).toBe(1);
  });

  it("does not mix scores between conditions", () => {
    const surface = makeFlatSurface(1);
    const boards = new Map([[0, surface]]);
    const sessions = [
      makeSession({ ai_advice: AI_Type.CORRECT, games: [makeGame(0, [{ x: 0, y: 0 }])] }),
      makeSession({ ai_advice: AI_Type.WRONG,   games: [makeGame(0, [{ x: 0, y: 0 }, { x: 0, y: 0 }])] }),
    ];
    const result = computeScoreByCondition(sessions, boards);
    expect(result.find((s) => s.aiType === AI_Type.CORRECT)!.mean).toBeCloseTo(1);
    expect(result.find((s) => s.aiType === AI_Type.WRONG)!.mean).toBeCloseTo(2);
  });

  it("returns entries in AI_Type order (NONE first, BAD_GOOD last)", () => {
    const result = computeScoreByCondition([], new Map());
    expect(result[0].aiType).toBe(AI_Type.NONE);
    expect(result[result.length - 1].aiType).toBe(AI_Type.BAD_GOOD);
  });
});

// ---------------------------------------------------------------------------
// computeScoreVsSkillPoints
// ---------------------------------------------------------------------------
describe("computeScoreVsSkillPoints", () => {
  it("returns an empty array for no sessions", () => {
    expect(computeScoreVsSkillPoints([], new Map())).toEqual([]);
  });

  it("returns one point per session", () => {
    const sessions = [makeSession({}), makeSession({ user_uuid: "uuid-b" })];
    expect(computeScoreVsSkillPoints(sessions, new Map())).toHaveLength(2);
  });

  it("maps executionSkill correctly", () => {
    const [point] = computeScoreVsSkillPoints(
      [makeSession({ execution_skill: 75 })],
      new Map(),
    );
    expect(point.executionSkill).toBe(75);
  });

  it("carries aiType, label, and color for each point", () => {
    const [point] = computeScoreVsSkillPoints(
      [makeSession({ ai_advice: AI_Type.GOOD_BAD })],
      new Map(),
    );
    expect(point.aiType).toBe(AI_Type.GOOD_BAD);
    expect(point.label).toBe("Good→Bad");
    expect(point.color).toBe("#009E73");
  });
});

// ---------------------------------------------------------------------------
// computeGameOptimalProximity
// ---------------------------------------------------------------------------
describe("computeGameOptimalProximity", () => {
  // board_id 0, execution_skill 5 is a valid Perlin lookup
  const VALID_BOARD = 0;
  const VALID_SKILL = 5;

  it("returns null when the board/skill lookup fails (invalid boardId)", () => {
    const game = makeGame(999, []); // boardId 999 has no entry
    game.actual_aiming_coord = { x: 256, y: 256 };
    expect(computeGameOptimalProximity(game, VALID_SKILL)).toBeNull();
  });

  it("returns null when executionSkill is not a valid multiple of 5", () => {
    const game = makeGame(VALID_BOARD, []);
    game.actual_aiming_coord = { x: 256, y: 256 };
    expect(computeGameOptimalProximity(game, 52)).toBeNull();
  });

  it("returns 0 when actual_aiming_coord equals the optimal coord", () => {
    const optimal = getOptimalAimingCoord(VALID_BOARD, VALID_SKILL)!;
    const game = makeGame(VALID_BOARD, []);
    game.actual_aiming_coord = { x: optimal.x, y: optimal.y };
    expect(computeGameOptimalProximity(game, VALID_SKILL)).toBeCloseTo(0);
  });

  it("returns the correct Euclidean distance from actual aim to optimal", () => {
    const optimal = getOptimalAimingCoord(VALID_BOARD, VALID_SKILL)!;
    // Offset by 3 in x and 4 in y → distance should be 5 (3-4-5 right triangle)
    const game = makeGame(VALID_BOARD, []);
    game.actual_aiming_coord = { x: optimal.x + 3, y: optimal.y + 4 };
    expect(computeGameOptimalProximity(game, VALID_SKILL)).toBeCloseTo(5);
  });
});

// ---------------------------------------------------------------------------
// computeOptimalProximityVsScorePoints
// ---------------------------------------------------------------------------
describe("computeOptimalProximityVsScorePoints", () => {
  it("returns an empty array for no sessions", () => {
    expect(computeOptimalProximityVsScorePoints([], new Map())).toEqual([]);
  });

  it("returns one point per session", () => {
    const sessions = [makeSession({}), makeSession({ user_uuid: "uuid-b" })];
    expect(computeOptimalProximityVsScorePoints(sessions, new Map())).toHaveLength(2);
  });

  it("sessionIndex matches the session's position in the input array", () => {
    const sessions = [
      makeSession({ user_uuid: "uuid-a" }),
      makeSession({ user_uuid: "uuid-b" }),
      makeSession({ user_uuid: "uuid-c" }),
    ];
    const points = computeOptimalProximityVsScorePoints(sessions, new Map());
    expect(points[0].sessionIndex).toBe(0);
    expect(points[1].sessionIndex).toBe(1);
    expect(points[2].sessionIndex).toBe(2);
  });

  it("avgProximity is null when boardId has no lookup entry", () => {
    // board_id 999 has no entry in either aiming table
    const session = makeSession({
      execution_skill: 50,
      games: [makeGame(999, [])],
    });
    const [point] = computeOptimalProximityVsScorePoints([session], new Map());
    expect(point.avgProximity).toBeNull();
  });

  it("avgProximity is the mean of per-game optimal distances", () => {
    // Using a valid board so the lookup succeeds; distance depends on actual_aiming_coord
    const optimal = getOptimalAimingCoord(0, 50)!;

    const game1 = makeGame(0, []);
    game1.actual_aiming_coord = { x: optimal.x + 3, y: optimal.y + 4 }; // dist = 5

    const game2 = makeGame(0, []);
    game2.actual_aiming_coord = { x: optimal.x, y: optimal.y + 10 }; // dist = 10

    const session = makeSession({ execution_skill: 50, games: [game1, game2] });
    const [point] = computeOptimalProximityVsScorePoints([session], new Map());
    expect(point.avgProximity).toBeCloseTo(7.5);
  });

  it("carries aiType, color, and session reference", () => {
    const session = makeSession({ ai_advice: AI_Type.CORRECT });
    const [point] = computeOptimalProximityVsScorePoints([session], new Map());
    expect(point.aiType).toBe(AI_Type.CORRECT);
    expect(point.color).toBe("#0072B2");
    expect(point.session).toBe(session);
  });
});

// ---------------------------------------------------------------------------
// computeProximityVsScorePoints — sessionIndex regression
// ---------------------------------------------------------------------------
describe("computeProximityVsScorePoints sessionIndex", () => {
  it("sessionIndex matches the session's position in the input array", () => {
    const sessions = [
      makeSession({ user_uuid: "uuid-a" }),
      makeSession({ user_uuid: "uuid-b" }),
      makeSession({ user_uuid: "uuid-c" }),
    ];
    const points = computeProximityVsScorePoints(sessions, new Map());
    expect(points[0].sessionIndex).toBe(0);
    expect(points[1].sessionIndex).toBe(1);
    expect(points[2].sessionIndex).toBe(2);
  });
});
