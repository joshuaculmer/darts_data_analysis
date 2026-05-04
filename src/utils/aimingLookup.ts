import perlinAiming from "../data/Perlin_Aiming.json";
import gaussianAiming from "../data/Gaussian_Aiming.json";

/**
 * Returns the optimal aiming coordinate as canvas (x, y) for the given board
 * and execution skill level.
 *
 * JSON stores [row, col] in surface-array space. AI_Correct converts via
 * toCoord(col, row), so canvas_x = JSON[1], canvas_y = JSON[0].
 *
 * Board IDs 0–99 → Perlin; 100–199 → Gaussian (inner index = id − 100).
 * executionSkill must be a positive multiple of 5; rowIdx = (skill − 5) / 5.
 */
export function getOptimalAimingCoord(
  boardId: number,
  executionSkill: number
): { x: number; y: number } | null {
  const rowIdx = (executionSkill - 5) / 5;
  if (!Number.isInteger(rowIdx) || rowIdx < 0) return null;

  let table: [number, number][] | undefined;
  if (boardId >= 0 && boardId <= 99) {
    table = (perlinAiming as [number, number][][])[boardId];
  } else if (boardId >= 100 && boardId <= 199) {
    table = (gaussianAiming as [number, number][][])[boardId - 100];
  }

  const row = table?.[rowIdx];
  if (!row || typeof row[0] !== "number" || typeof row[1] !== "number") return null;

  // JSON is [surfaceFirstIdx, surfaceSecondIdx]; canvas x = secondIdx, canvas y = firstIdx
  return { x: row[1], y: row[0] };
}
