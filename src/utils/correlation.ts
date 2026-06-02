import type { SessionVariableRow, VariableKey } from "./variables";

export interface CorrelationResult {
  /** Spearman rank correlation; null if < 2 complete pairs or zero variance. */
  r: number | null;
  /** Number of pairwise-complete observations the coefficient is based on. */
  n: number;
}

export interface CorrelationCell extends CorrelationResult {
  keyI: VariableKey;
  keyJ: VariableKey;
}

/** Average ranks (1-based) with ties resolved to the mean of their positions. */
function rank(values: number[]): number[] {
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const ranks = new Array<number>(values.length);
  let k = 0;
  while (k < indexed.length) {
    let j = k;
    while (j + 1 < indexed.length && indexed[j + 1].v === indexed[k].v) j += 1;
    const avgRank = (k + j) / 2 + 1; // positions k..j are 0-based; ranks are 1-based
    for (let m = k; m <= j; m += 1) ranks[indexed[m].i] = avgRank;
    k = j + 1;
  }
  return ranks;
}

function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

/**
 * Spearman rank correlation between two variables, pairwise-complete: pairs
 * where either value is null/NaN are dropped before ranking. Returns the
 * coefficient plus the number of complete pairs it is based on.
 */
export function spearman(
  xs: (number | null)[],
  ys: (number | null)[],
): CorrelationResult {
  const px: number[] = [];
  const py: number[] = [];
  const len = Math.min(xs.length, ys.length);
  for (let i = 0; i < len; i += 1) {
    const a = xs[i];
    const b = ys[i];
    if (a == null || b == null || Number.isNaN(a) || Number.isNaN(b)) continue;
    px.push(a);
    py.push(b);
  }
  const n = px.length;
  if (n < 2) return { r: null, n };
  return { r: pearson(rank(px), rank(py)), n };
}

/**
 * Full pairwise Spearman matrix across the requested variable keys. cell[i][j]
 * correlates keys[i] against keys[j]; the diagonal is r = 1 (n = count of
 * non-null values for that key). Each cell carries its own pairwise-complete n.
 */
export function computeCorrelationMatrix(
  rows: SessionVariableRow[],
  keys: VariableKey[],
): CorrelationCell[][] {
  const columns = keys.map((key) => rows.map((row) => row[key]));
  return keys.map((keyI, i) =>
    keys.map((keyJ, j) => ({ keyI, keyJ, ...spearman(columns[i], columns[j]) })),
  );
}
