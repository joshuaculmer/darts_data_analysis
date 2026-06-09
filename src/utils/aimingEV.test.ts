import { describe, it, expect } from "vitest";
import { getAimEV } from "./aimingEV";
import { evGridKey, EV_GRID_SIZE } from "../loaders/loadEvGrids";
import type { EvGrids } from "../loaders/loadEvGrids";

/** Grid where EV at (x, y) = x * 1000 + y, for unambiguous index checks. */
function makeGrids(boardId: number, skill: number): EvGrids {
  const grid = new Float32Array(EV_GRID_SIZE * EV_GRID_SIZE);
  for (let x = 0; x < EV_GRID_SIZE; x++) {
    for (let y = 0; y < EV_GRID_SIZE; y++) {
      grid[x * EV_GRID_SIZE + y] = x * 1000 + y;
    }
  }
  return new Map([[evGridKey(boardId, skill), grid]]);
}

describe("getAimEV", () => {
  const grids = makeGrids(5, 20);

  it("looks up the grid in [x][y] order with floored coordinates", () => {
    expect(getAimEV(grids, 5, 20, { x: 100.9, y: 200.2 })).toBe(100 * 1000 + 200);
  });

  it("returns null when no grid exists for the (board, skill) pair", () => {
    expect(getAimEV(grids, 5, 45, { x: 100, y: 200 })).toBeNull();
    expect(getAimEV(grids, 6, 20, { x: 100, y: 200 })).toBeNull();
    expect(getAimEV(new Map(), 5, 20, { x: 100, y: 200 })).toBeNull();
  });

  it("returns null for coordinates outside the 512×512 grid", () => {
    expect(getAimEV(grids, 5, 20, { x: -1, y: 0 })).toBeNull();
    expect(getAimEV(grids, 5, 20, { x: 0, y: 512 })).toBeNull();
  });

  it("returns null for a null coordinate", () => {
    expect(getAimEV(grids, 5, 20, null)).toBeNull();
  });
});
