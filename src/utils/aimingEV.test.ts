import { describe, it, expect } from "vitest";
import { getAimEV, EV_PER_HIT_PLACEHOLDER } from "./aimingEV";

// ---------------------------------------------------------------------------
// getAimEV — placeholder stub (returns a flat EV per hit until the EV JSON lands)
// ---------------------------------------------------------------------------
describe("getAimEV", () => {
  it("returns the placeholder EV regardless of board, aim, or skill", () => {
    expect(getAimEV(0, { x: 100, y: 200 }, 5)).toBe(EV_PER_HIT_PLACEHOLDER);
    expect(getAimEV(150, { x: 0, y: 0 }, 50)).toBe(EV_PER_HIT_PLACEHOLDER);
    expect(getAimEV(999, { x: 511, y: 511 }, 100)).toBe(EV_PER_HIT_PLACEHOLDER);
  });

  it("placeholder is 8 per hit", () => {
    expect(EV_PER_HIT_PLACEHOLDER).toBe(8);
  });
});
