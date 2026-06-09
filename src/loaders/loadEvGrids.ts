import type { ParsedGameSession } from "./loadData";

/**
 * EV (expected value per hit) grids, one per (board_id, execution_skill) pair,
 * produced from experiment_ev_grids.npz by tools/convert_ev_grids.py.
 *
 * Each grid is a flat 512×512 Float32Array in `[x][y]` row-major order — the
 * same convention as RewardSurface (`surface[floor(x)][floor(y)]`) — so
 * `grid[floor(x) * EV_GRID_SIZE + floor(y)]` is the EV of aiming at (x, y).
 * Keyed by {@link evGridKey}.
 */
export type EvGrids = Map<string, Float32Array>;

export const EV_GRID_SIZE = 512;

export function evGridKey(boardId: number, executionSkill: number): string {
  return `${boardId}:${executionSkill}`;
}

interface EvGridIndex {
  size: number;
  scale: number;
  pairs: [number, number][];
}

function evGridsBase(): string {
  return `${import.meta.env.BASE_URL.replace(/\/$/, "")}/ev_grids`;
}

/**
 * Fetches the EV grids for every (board_id, execution_skill) pair that appears
 * in the sessions and exists in public/ev_grids/index.json. Mirrors
 * loadBoards: missing/failed grids are skipped with a console warning, and
 * downstream lookups return null for them.
 */
export async function loadEvGrids(
  sessions: ParsedGameSession[],
): Promise<EvGrids> {
  const grids: EvGrids = new Map();

  let index: EvGridIndex;
  try {
    const res = await fetch(`${evGridsBase()}/index.json`);
    if (!res.ok) throw new Error(`ev_grids index returned ${res.status}`);
    index = (await res.json()) as EvGridIndex;
  } catch (err) {
    console.warn("Failed to load EV grid index:", err);
    return grids;
  }

  const available = new Set(index.pairs.map(([b, s]) => evGridKey(b, s)));
  const needed = new Map<string, [number, number]>();
  for (const session of sessions) {
    for (const game of session.games) {
      const key = evGridKey(game.board_id, session.execution_skill);
      if (available.has(key)) needed.set(key, [game.board_id, session.execution_skill]);
    }
  }

  const results = await Promise.allSettled(
    [...needed.entries()].map(async ([key, [boardId, skill]]) => {
      const res = await fetch(`${evGridsBase()}/ev_${boardId}_${skill}.bin`);
      if (!res.ok) throw new Error(`EV grid ${key} returned ${res.status}`);
      const raw = new Uint16Array(await res.arrayBuffer());
      const grid = new Float32Array(raw.length);
      for (let i = 0; i < raw.length; i++) grid[i] = raw[i] * index.scale;
      return [key, grid] as const;
    }),
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      const [key, grid] = result.value;
      grids.set(key, grid);
    } else {
      console.warn("Failed to load EV grid:", result.reason);
    }
  }
  return grids;
}
