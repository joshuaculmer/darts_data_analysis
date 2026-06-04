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
  gameScorePerHit,
  computeSessionScorePerHit,
  computeSessionScoreTotalPerHit,
  computeGameHitDispersion,
  computeSessionHitDispersion,
  computeGameEvGap,
  computeSessionEvGap,
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

  it("returns entries in AI_Type order (NONE first, PLAUSIBLE_GOOD last)", () => {
    const result = computeScoreByCondition([], new Map());
    expect(result[0].aiType).toBe(AI_Type.NONE);
    expect(result[result.length - 1].aiType).toBe(AI_Type.PLAUSIBLE_GOOD);
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
      [makeSession({ ai_advice: AI_Type.GOOD_PLAUSIBLE })],
      new Map(),
    );
    expect(point.aiType).toBe(AI_Type.GOOD_PLAUSIBLE);
    expect(point.label).toBe("Good→Plausible");
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
// gameScorePerHit — normalizes raw game score by hit count (dynamic 1/3/5/10)
// ---------------------------------------------------------------------------
describe("gameScorePerHit", () => {
  it("returns 0 for a game with no hits (divides by max(1, 0))", () => {
    const surface = makeFlatSurface(5);
    expect(gameScorePerHit(makeGame(0), surface)).toBe(0);
  });

  it("equals gameScore for a single-hit game", () => {
    const surface = makeFlatSurface(7);
    const game = makeGame(0, [{ x: 0, y: 0 }]);
    expect(gameScorePerHit(game, surface)).toBe(gameScore(game, surface));
  });

  it("divides total score by hit count so hit count does not confound", () => {
    const surface = makeFlatSurface(2);
    // 2 hits → total 4 → per-hit 2; 5 hits → total 10 → per-hit 2
    expect(gameScorePerHit(makeGame(0, Array(2).fill({ x: 0, y: 0 })), surface)).toBe(2);
    expect(gameScorePerHit(makeGame(0, Array(5).fill({ x: 0, y: 0 })), surface)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// computeSessionScorePerHit — mean per-hit score across a session's games
// ---------------------------------------------------------------------------
describe("computeSessionScorePerHit", () => {
  it("returns 0 for a session with no games", () => {
    expect(computeSessionScorePerHit(makeSession({ games: [] }), new Map())).toBe(0);
  });

  it("averages per-hit scores across games, not raw totals", () => {
    const boards = new Map([
      [0, makeFlatSurface(2)],
      [1, makeFlatSurface(6)],
    ]);
    const games = [
      makeGame(0, Array(2).fill({ x: 0, y: 0 })), // per-hit 2
      makeGame(1, Array(3).fill({ x: 0, y: 0 })), // per-hit 6
    ];
    // mean(2, 6) = 4
    expect(computeSessionScorePerHit(makeSession({ games }), boards)).toBeCloseTo(4);
  });

  it("scores games with a missing board as 0 per hit", () => {
    const result = computeSessionScorePerHit(
      makeSession({ games: [makeGame(99, [{ x: 0, y: 0 }])] }),
      new Map(),
    );
    expect(result).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeSessionScoreTotalPerHit — total score ÷ total hit count
// ---------------------------------------------------------------------------
describe("computeSessionScoreTotalPerHit", () => {
  it("returns 0 for a session with no games", () => {
    expect(computeSessionScoreTotalPerHit(makeSession({ games: [] }), new Map())).toBe(0);
  });

  it("divides total score by total hit count, weighting by hit count", () => {
    const boards = new Map([
      [0, makeFlatSurface(2)],
      [1, makeFlatSurface(6)],
    ]);
    const games = [
      makeGame(0, Array(2).fill({ x: 0, y: 0 })), // 2 hits × 2 = 4
      makeGame(1, Array(3).fill({ x: 0, y: 0 })), // 3 hits × 6 = 18
    ];
    // total score 22 ÷ 5 hits = 4.4 (vs per-game mean of 4)
    expect(computeSessionScoreTotalPerHit(makeSession({ games }), boards)).toBeCloseTo(4.4);
  });

  it("counts hits from boardless games as zero score but still in the denominator", () => {
    const boards = new Map([[0, makeFlatSurface(10)]]);
    const games = [
      makeGame(0, Array(2).fill({ x: 0, y: 0 })), // 2 hits × 10 = 20
      makeGame(99, Array(2).fill({ x: 0, y: 0 })), // missing board → 0 score, 2 hits
    ];
    // 20 ÷ 4 hits = 5
    expect(computeSessionScoreTotalPerHit(makeSession({ games }), boards)).toBeCloseTo(5);
  });
});

// ---------------------------------------------------------------------------
// computeGameHitDispersion — spread of hits around the actual aim point
// ---------------------------------------------------------------------------
describe("computeGameHitDispersion", () => {
  it("returns zero mean and std for a game with no hits", () => {
    expect(computeGameHitDispersion(makeGame(0, []))).toEqual({ mean: 0, std: 0 });
  });

  it("returns zero std for a single hit", () => {
    const game = makeGame(0, [{ x: 3, y: 4 }]);
    game.actual_aiming_coord = { x: 0, y: 0 };
    const d = computeGameHitDispersion(game);
    expect(d.mean).toBeCloseTo(5);
    expect(d.std).toBe(0);
  });

  it("computes mean and sample std of distances from each hit to the actual aim", () => {
    const game = makeGame(0, [{ x: 3, y: 4 }, { x: 0, y: 0 }]); // dists 5 and 0
    game.actual_aiming_coord = { x: 0, y: 0 };
    const d = computeGameHitDispersion(game);
    expect(d.mean).toBeCloseTo(2.5);
    // sample std of [5, 0]: sqrt(((5-2.5)^2 + (0-2.5)^2) / (2-1)) = sqrt(12.5)
    expect(d.std).toBeCloseTo(Math.sqrt(12.5));
  });
});

// ---------------------------------------------------------------------------
// computeSessionHitDispersion — mean over games of per-game dispersion
// ---------------------------------------------------------------------------
describe("computeSessionHitDispersion", () => {
  it("returns zero for a session with no games", () => {
    expect(computeSessionHitDispersion(makeSession({ games: [] }))).toEqual({ mean: 0, std: 0 });
  });

  it("averages per-game mean and std across games", () => {
    const g1 = makeGame(0, [{ x: 4, y: 0 }, { x: 0, y: 0 }]); // dists 4, 0 → mean 2, std sqrt(8)
    g1.actual_aiming_coord = { x: 0, y: 0 };
    const g2 = makeGame(0, [{ x: 6, y: 0 }, { x: 0, y: 0 }]); // dists 6, 0 → mean 3, std sqrt(18)
    g2.actual_aiming_coord = { x: 0, y: 0 };
    const d = computeSessionHitDispersion(makeSession({ games: [g1, g2] }));
    expect(d.mean).toBeCloseTo(2.5); // mean(2, 3)
    expect(d.std).toBeCloseTo((Math.sqrt(8) + Math.sqrt(18)) / 2);
  });
});

// ---------------------------------------------------------------------------
// computeGameEvGap / computeSessionEvGap — per-hit gap vs placeholder EV
// ---------------------------------------------------------------------------
describe("computeGameEvGap", () => {
  it("is per-hit score minus the placeholder EV (8)", () => {
    const surface = makeFlatSurface(10); // 2 hits → total 20 → per-hit 10
    const game = makeGame(0, Array(2).fill({ x: 0, y: 0 }));
    expect(computeGameEvGap(game, surface, 50)).toBeCloseTo(2); // 10 - 8
  });

  it("is negative when per-hit score is below the placeholder EV", () => {
    const surface = makeFlatSurface(3);
    const game = makeGame(0, [{ x: 0, y: 0 }]);
    expect(computeGameEvGap(game, surface, 50)).toBeCloseTo(-5); // 3 - 8
  });
});

describe("computeSessionEvGap", () => {
  it("returns 0 for a session with no games", () => {
    expect(computeSessionEvGap(makeSession({ games: [] }), new Map())).toBe(0);
  });

  it("averages per-game ev gaps across the session", () => {
    const boards = new Map([
      [0, makeFlatSurface(10)], // per-hit 10 → gap +2
      [1, makeFlatSurface(4)], // per-hit 4 → gap -4
    ]);
    const games = [
      makeGame(0, Array(2).fill({ x: 0, y: 0 })),
      makeGame(1, [{ x: 0, y: 0 }]),
    ];
    // mean(2, -4) = -1
    expect(computeSessionEvGap(makeSession({ games }), boards)).toBeCloseTo(-1);
  });

  it("treats a missing board as 0 per-hit (gap = -8)", () => {
    const result = computeSessionEvGap(
      makeSession({ games: [makeGame(99, [{ x: 0, y: 0 }])] }),
      new Map(),
    );
    expect(result).toBeCloseTo(-8);
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
