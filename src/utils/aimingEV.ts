import type { Coord } from "../types/dart";
import { EV_GRID_SIZE, evGridKey } from "../loaders/loadEvGrids";
import type { EvGrids } from "../loaders/loadEvGrids";

/** The EV grids store expected value for a 10-hit game; divide to get per-hit EV. */
export const EV_GRID_HITS = 10;

/**
 * Expected value per hit of aiming at `aimCoord` on a board, given the
 * player's execution skill. Looks up the precomputed EV grid for the
 * (board_id, execution_skill) pair (see loadEvGrids.ts) and divides by
 * {@link EV_GRID_HITS}; returns null when no grid was loaded for that pair,
 * the coord is null, or it falls outside the 512×512 grid.
 */
export function getAimEV(
  evGrids: EvGrids,
  boardId: number,
  executionSkill: number,
  aimCoord: Coord | null,
): number | null {
  if (!aimCoord) return null;
  const grid = evGrids.get(evGridKey(boardId, executionSkill));
  if (!grid) return null;
  const x = Math.floor(aimCoord.x);
  const y = Math.floor(aimCoord.y);
  if (x < 0 || x >= EV_GRID_SIZE || y < 0 || y >= EV_GRID_SIZE) return null;
  return grid[x * EV_GRID_SIZE + y] / EV_GRID_HITS;
}
