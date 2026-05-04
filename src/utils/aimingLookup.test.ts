import { describe, it, expect } from "vitest";
import { getOptimalAimingCoord } from "./aimingLookup";
import perlinAiming from "../data/Perlin_Aiming.json";
import gaussianAiming from "../data/Gaussian_Aiming.json";

// ---------------------------------------------------------------------------
// getOptimalAimingCoord
// ---------------------------------------------------------------------------
describe("getOptimalAimingCoord", () => {
  // --- invalid inputs return null ---

  it("returns null for boardId < 0", () => {
    expect(getOptimalAimingCoord(-1, 50)).toBeNull();
  });

  it("returns null for boardId > 199", () => {
    expect(getOptimalAimingCoord(200, 50)).toBeNull();
  });

  it("returns null for executionSkill that is not a positive multiple of 5", () => {
    expect(getOptimalAimingCoord(0, 52)).toBeNull();
  });

  it("returns null for executionSkill 0 (produces rowIdx -1)", () => {
    expect(getOptimalAimingCoord(0, 0)).toBeNull();
  });

  it("returns null for a skill beyond the table range (rowIdx out of bounds)", () => {
    // skills 5..150 → rowIdx 0..29; skill 155 → rowIdx 30 → undefined
    expect(getOptimalAimingCoord(0, 155)).toBeNull();
  });

  // --- coordinate swap: JSON stores [surfaceRow, surfaceCol]; canvas x = col, y = row ---

  it("returns canvas coords with x=JSON[1] and y=JSON[0] for a Perlin board", () => {
    const boardId = 0;
    const skill = 5;
    const rowIdx = (skill - 5) / 5; // 0
    const raw = (perlinAiming as number[][][])[boardId][rowIdx];
    const result = getOptimalAimingCoord(boardId, skill);
    expect(result).not.toBeNull();
    expect(result!.x).toBe(raw[1]);
    expect(result!.y).toBe(raw[0]);
  });

  it("correctly indexes mid-range skills for a Perlin board", () => {
    const boardId = 5;
    const skill = 75; // rowIdx = 14
    const rowIdx = (skill - 5) / 5;
    const raw = (perlinAiming as number[][][])[boardId][rowIdx];
    const result = getOptimalAimingCoord(boardId, skill);
    expect(result).not.toBeNull();
    expect(result!.x).toBe(raw[1]);
    expect(result!.y).toBe(raw[0]);
  });

  it("uses inner index (boardId - 100) for Gaussian boards", () => {
    const boardId = 100;
    const skill = 5;
    const innerIdx = boardId - 100; // 0
    const rowIdx = (skill - 5) / 5;  // 0
    const raw = (gaussianAiming as number[][][])[innerIdx][rowIdx];
    const result = getOptimalAimingCoord(boardId, skill);
    expect(result).not.toBeNull();
    expect(result!.x).toBe(raw[1]);
    expect(result!.y).toBe(raw[0]);
  });

  it("resolves the last valid Gaussian board (199)", () => {
    const boardId = 199;
    const skill = 50;
    const innerIdx = boardId - 100; // 99
    const rowIdx = (skill - 5) / 5;  // 9
    const raw = (gaussianAiming as number[][][])[innerIdx][rowIdx];
    const result = getOptimalAimingCoord(boardId, skill);
    expect(result).not.toBeNull();
    expect(result!.x).toBe(raw[1]);
    expect(result!.y).toBe(raw[0]);
  });

  it("returns a result for the maximum valid skill (150)", () => {
    expect(getOptimalAimingCoord(0, 150)).not.toBeNull();
  });

  it("x and y are both numbers within the board surface range [0, 511]", () => {
    const result = getOptimalAimingCoord(10, 50)!;
    expect(result).not.toBeNull();
    expect(result.x).toBeGreaterThanOrEqual(0);
    expect(result.x).toBeLessThanOrEqual(511);
    expect(result.y).toBeGreaterThanOrEqual(0);
    expect(result.y).toBeLessThanOrEqual(511);
  });
});
