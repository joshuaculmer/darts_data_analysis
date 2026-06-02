import { describe, it, expect } from "vitest";
import { spearman, computeCorrelationMatrix } from "./correlation";
import type { SessionVariableRow } from "./variables";

// ---------------------------------------------------------------------------
// spearman — rank correlation, pairwise-complete
// ---------------------------------------------------------------------------
describe("spearman", () => {
  it("returns r ≈ 1 for a perfectly monotonic increasing relationship", () => {
    const { r, n } = spearman([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]);
    expect(r).toBeCloseTo(1);
    expect(n).toBe(5);
  });

  it("returns r ≈ -1 for a perfectly monotonic decreasing relationship", () => {
    const { r } = spearman([1, 2, 3, 4, 5], [10, 8, 6, 4, 2]);
    expect(r).toBeCloseTo(-1);
  });

  it("returns r ≈ 1 for a nonlinear but monotonic relationship (rank-based)", () => {
    // y = x^3 is nonlinear; Spearman sees identical ranks → r = 1
    const { r } = spearman([1, 2, 3, 4], [1, 8, 27, 64]);
    expect(r).toBeCloseTo(1);
  });

  it("returns r ≈ 0 for an independent / non-monotonic relationship", () => {
    // V shape: ranks of y are symmetric → no monotonic trend
    const { r } = spearman([1, 2, 3, 4, 5], [5, 2, 1, 2, 5]);
    expect(r!).toBeCloseTo(0, 5);
  });

  it("drops pairs where either value is null (pairwise-complete) and reports n", () => {
    const { r, n } = spearman([1, 2, null, 4], [1, null, 3, 4]);
    // Only indices 0 and 3 survive: (1,1) and (4,4) → perfect order
    expect(n).toBe(2);
    expect(r).toBeCloseTo(1);
  });

  it("returns r = null and n when fewer than 2 complete pairs remain", () => {
    expect(spearman([1, null], [null, 2])).toEqual({ r: null, n: 0 });
    expect(spearman([1], [2])).toEqual({ r: null, n: 1 });
  });

  it("returns r = null when one variable has zero variance (constant)", () => {
    const { r, n } = spearman([1, 2, 3, 4], [7, 7, 7, 7]);
    expect(r).toBeNull();
    expect(n).toBe(4);
  });

  it("handles ties via average ranks without throwing", () => {
    const { r, n } = spearman([1, 1, 2, 3], [1, 2, 3, 4]);
    expect(n).toBe(4);
    expect(typeof r).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// computeCorrelationMatrix
// ---------------------------------------------------------------------------
function makeRow(overrides: Partial<SessionVariableRow>): SessionVariableRow {
  return {
    user_uuid: "uuid-a",
    sessionIndex: 0,
    ai_advice: 0,
    trust: null,
    influence: null,
    proxAI: null,
    satisfied: null,
    scorePerHit: null,
    proxOptimal: null,
    luck: null,
    dispersion: null,
    evGap: null,
    ...overrides,
  };
}

describe("computeCorrelationMatrix", () => {
  const rows = [
    makeRow({ trust: 1, scorePerHit: 2 }),
    makeRow({ trust: 2, scorePerHit: 4 }),
    makeRow({ trust: 3, scorePerHit: 6 }),
    makeRow({ trust: 4, scorePerHit: 8 }),
  ];

  it("produces a square matrix sized to the requested keys", () => {
    const m = computeCorrelationMatrix(rows, ["trust", "scorePerHit"]);
    expect(m).toHaveLength(2);
    expect(m[0]).toHaveLength(2);
  });

  it("has r = 1 on the diagonal with n = count of non-null values", () => {
    const m = computeCorrelationMatrix(rows, ["trust", "scorePerHit"]);
    expect(m[0][0].r).toBeCloseTo(1);
    expect(m[0][0].n).toBe(4);
  });

  it("computes the off-diagonal correlation between two variables", () => {
    const m = computeCorrelationMatrix(rows, ["trust", "scorePerHit"]);
    expect(m[0][1].r).toBeCloseTo(1);
    expect(m[0][1].keyI).toBe("trust");
    expect(m[0][1].keyJ).toBe("scorePerHit");
  });

  it("is symmetric: cell[i][j].r equals cell[j][i].r", () => {
    const m = computeCorrelationMatrix(rows, ["trust", "scorePerHit"]);
    expect(m[0][1].r).toBeCloseTo(m[1][0].r!);
  });

  it("reports pairwise-complete n per cell when some values are null", () => {
    const mixed = [
      makeRow({ trust: 1, luck: 5 }),
      makeRow({ trust: 2, luck: null }), // luck missing → drops from trust×luck pair
      makeRow({ trust: 3, luck: 1 }),
    ];
    const m = computeCorrelationMatrix(mixed, ["trust", "luck"]);
    expect(m[0][1].n).toBe(2);
  });
});
