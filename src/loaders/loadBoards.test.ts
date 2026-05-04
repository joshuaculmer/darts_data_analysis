import { describe, it, expect, vi, afterEach } from "vitest";
import { AI_Type } from "../types/dart";
import type { ParsedGameSession } from "./loadData";
import { loadBoards } from "./loadBoards";

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeSession(boardIds: number[]): ParsedGameSession {
  return {
    id: "s1",
    created_at: "2024-01-15T10:00:00Z",
    user_uuid: "uuid-a",
    user_nickname: null,
    execution_skill: 50,
    games_played: boardIds.length,
    ai_advice: AI_Type.NONE,
    games: boardIds.map((id) => ({
      board_id: id,
      start: 0,
      end: 0,
      suggested_aiming_coord: null,
      actual_aiming_coord: { x: 0, y: 0 },
      hits: [],
    })),
  };
}

function mockFetch(surfaces: Record<number, number[][]>, failIds: number[] = []) {
  const fetchMock = vi.fn((url: string) => {
    // Resolve URL back to the unified board_id used as the key in surfaces
    const perlinMatch = url.match(/PerlinNoiseBoard(\d+)\.json$/);
    const gaussianMatch = url.match(/GaussianSumBoard(\d+)\.json$/);
    let id: number;
    if (perlinMatch) {
      id = Number(perlinMatch[1]);
    } else if (gaussianMatch) {
      id = Number(gaussianMatch[1]) + 100;
    } else {
      id = -1;
    }
    if (failIds.includes(id)) {
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null) });
    }
    const surface = surfaces[id];
    if (!surface) {
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve(surface) });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

// ---------------------------------------------------------------------------
// URL construction
// ---------------------------------------------------------------------------
describe("loadBoards — URL construction", () => {
  it("fetches the correct URL for single-digit board IDs (no zero-padding)", async () => {
    const surface = [[1]];
    const fetchMock = mockFetch({ 3: surface });
    await loadBoards([makeSession([3])]);
    expect(fetchMock).toHaveBeenCalledWith("/Perlin_Noise_Surfaces.ts/PerlinNoiseBoard3.json");
  });

  it("fetches the correct URL for double-digit board IDs", async () => {
    const surface = [[1]];
    const fetchMock = mockFetch({ 42: surface });
    await loadBoards([makeSession([42])]);
    expect(fetchMock).toHaveBeenCalledWith("/Perlin_Noise_Surfaces.ts/PerlinNoiseBoard42.json");
  });

  it("fetches each unique board ID exactly once even if referenced multiple times", async () => {
    const fetchMock = mockFetch({ 1: [[1]] });
    // board 1 appears in three different games across two sessions
    await loadBoards([makeSession([1, 1]), makeSession([1])]);
    const calls = fetchMock.mock.calls.map((c) => c[0] as string);
    const board1Calls = calls.filter((u) => u.includes("PerlinNoiseBoard1.json"));
    expect(board1Calls).toHaveLength(1);
  });

  it("fetches Gaussian URL for board ID 100 (maps to GaussianSumBoard0)", async () => {
    const surface = [[1]];
    const fetchMock = mockFetch({ 100: surface });
    await loadBoards([makeSession([100])]);
    expect(fetchMock).toHaveBeenCalledWith("/Gaussian_Sum/GaussianSumBoard0.json");
  });

  it("fetches Gaussian URL for board ID 142 (maps to GaussianSumBoard42)", async () => {
    const surface = [[1]];
    const fetchMock = mockFetch({ 142: surface });
    await loadBoards([makeSession([142])]);
    expect(fetchMock).toHaveBeenCalledWith("/Gaussian_Sum/GaussianSumBoard42.json");
  });

  it("fetches Gaussian URL for board ID 199 (maps to GaussianSumBoard99)", async () => {
    const surface = [[1]];
    const fetchMock = mockFetch({ 199: surface });
    await loadBoards([makeSession([199])]);
    expect(fetchMock).toHaveBeenCalledWith("/Gaussian_Sum/GaussianSumBoard99.json");
  });

  it("fetches Perlin and Gaussian URLs correctly in a mixed session", async () => {
    const fetchMock = mockFetch({ 3: [[1]], 100: [[2]] });
    await loadBoards([makeSession([3, 100])]);
    const urls = fetchMock.mock.calls.map((c) => c[0] as string);
    expect(urls).toContain("/Perlin_Noise_Surfaces.ts/PerlinNoiseBoard3.json");
    expect(urls).toContain("/Gaussian_Sum/GaussianSumBoard0.json");
  });
});

// ---------------------------------------------------------------------------
// Map population
// ---------------------------------------------------------------------------
describe("loadBoards — map population", () => {
  it("returns an empty map for sessions with no games", async () => {
    const fetchMock = mockFetch({});
    const result = await loadBoards([makeSession([])]);
    expect(result.size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a map entry for each successfully loaded board", async () => {
    const surface0 = [[0, 1], [2, 3]];
    const surface5 = [[9, 8], [7, 6]];
    mockFetch({ 0: surface0, 5: surface5 });
    const result = await loadBoards([makeSession([0, 5])]);
    expect(result.size).toBe(2);
    expect(result.get(0)).toEqual(surface0);
    expect(result.get(5)).toEqual(surface5);
  });

  it("surface values are accessible by [x][y] coordinate", async () => {
    // 3×3 surface where value = x * 10 + y
    const surface = Array.from({ length: 3 }, (_, x) =>
      Array.from({ length: 3 }, (_, y) => x * 10 + y),
    );
    mockFetch({ 7: surface });
    const result = await loadBoards([makeSession([7])]);
    const loaded = result.get(7)!;
    expect(loaded[0][0]).toBe(0);
    expect(loaded[1][2]).toBe(12);
    expect(loaded[2][1]).toBe(21);
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
describe("loadBoards — error handling", () => {
  it("omits a board from the map when the fetch returns a non-ok status", async () => {
    mockFetch({ 1: [[1]] }, [99]);
    const result = await loadBoards([makeSession([1, 99])]);
    expect(result.has(1)).toBe(true);
    expect(result.has(99)).toBe(false);
  });

  it("still returns successfully loaded boards when one board fails", async () => {
    mockFetch({ 2: [[2]], 3: [[3]] }, [99]);
    const result = await loadBoards([makeSession([2, 3, 99])]);
    expect(result.size).toBe(2);
  });

  it("returns an empty map if all boards fail", async () => {
    mockFetch({}, [0, 1, 2]);
    const result = await loadBoards([makeSession([0, 1, 2])]);
    expect(result.size).toBe(0);
  });
});
