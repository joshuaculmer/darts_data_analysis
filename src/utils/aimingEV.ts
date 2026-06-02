import type { Coord } from "../types/dart";

/**
 * Placeholder expected-value-per-hit (EV) for aiming at a given coord on a board.
 *
 * STUB: returns a flat value regardless of inputs. A forthcoming JSON (EV per
 * board × aim location × execution skill) will replace the body of getAimEV
 * without touching call sites. Mirror aimingLookup.ts's boardId routing
 * (0–99 Perlin, 100–199 Gaussian) when that data lands.
 */
export const EV_PER_HIT_PLACEHOLDER = 8;

export function getAimEV(
  _boardId: number,
  _aimCoord: Coord,
  _executionSkill: number,
): number {
  return EV_PER_HIT_PLACEHOLDER;
}
