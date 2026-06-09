import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loadEvGrids, evGridKey, EV_GRID_SIZE } from "./loadEvGrids";
import type { ParsedGameSession } from "./loadData";
import type { DartGameDTO } from "../types/dart";

function makeGame(board_id: number): DartGameDTO {
  return {
    board_id,
    start: 0,
    end: 1000,
    suggested_aiming_coord: null,
    actual_aiming_coord: { x: 0, y: 0 },
    hits: [],
  };
}

function makeSession(
  execution_skill: number,
  boardIds: number[],
): ParsedGameSession {
  return {
    user_uuid: "u1",
    user_nickname: null,
    execution_skill,
    games_played: boardIds.length,
    ai_advice: 0,
    games: boardIds.map(makeGame),
    created_at: "2026-01-01T00:00:00Z",
  } as ParsedGameSession;
}

const SCALE = 100 / 65535;

/** index.json + one bin per listed pair; bin filled with a constant uint16. */
function mockFetch(pairs: [number, number][], fillValue = 32768) {
  return vi.fn(async (url: string) => {
    if (String(url).endsWith("index.json")) {
      return {
        ok: true,
        json: async () => ({ size: EV_GRID_SIZE, scale: SCALE, pairs }),
      };
    }
    const m = String(url).match(/ev_(\d+)_(\d+)\.bin$/);
    const listed =
      m && pairs.some(([b, s]) => b === Number(m[1]) && s === Number(m[2]));
    if (!listed) return { ok: false, status: 404 };
    const data = new Uint16Array(EV_GRID_SIZE * EV_GRID_SIZE).fill(fillValue);
    return { ok: true, arrayBuffer: async () => data.buffer };
  });
}

describe("evGridKey", () => {
  it("combines board id and skill", () => {
    expect(evGridKey(42, 15)).toBe("42:15");
  });
});

describe("loadEvGrids", () => {
  beforeEach(() => {
    vi.stubEnv("BASE_URL", "/");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("fetches only the (board, skill) pairs present in the sessions and the index", async () => {
    const fetchMock = mockFetch([
      [0, 20],
      [1, 20],
      [7, 45],
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const grids = await loadEvGrids([
      makeSession(20, [0, 0, 1]),
      makeSession(45, [7, 99]), // (99, 45) not in index → not fetched
    ]);

    expect([...grids.keys()].sort()).toEqual(["0:20", "1:20", "7:45"]);
    // index.json + 3 bins; no request for the unlisted (99, 45) pair
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("decodes uint16 bins into EV values via the index scale", async () => {
    vi.stubGlobal("fetch", mockFetch([[0, 20]], 32768));
    const grids = await loadEvGrids([makeSession(20, [0])]);
    const grid = grids.get("0:20")!;
    expect(grid.length).toBe(EV_GRID_SIZE * EV_GRID_SIZE);
    expect(grid[0]).toBeCloseTo(32768 * SCALE, 4);
  });

  it("returns an empty map when the index cannot be fetched", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404 })));
    const grids = await loadEvGrids([makeSession(20, [0])]);
    expect(grids.size).toBe(0);
  });
});
