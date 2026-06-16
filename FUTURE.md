# Future Work — Performance

Notes on potential speed-ups that were scoped out (or deliberately deferred) during the
loading-spinner / Raw Data optimization pass. None of these are blocking; capture-for-later.

## Context: what's already done
- **Raw Data**: the three tables virtualize their rows (`VirtualizedTable`, only ~30 rows in the
  DOM), filters are debounced, and `SessionsTable` reuses App's precomputed `variableRows` instead
  of recomputing the join + variable build.
- **Routing**: heavy pages are `React.lazy` code-split; `RouteSpinnerGate` shows the spinner on
  every top-level tab change and defers the page mount so the heavy synchronous render happens
  behind an already-painted spinner.

> Important framing: `RouteSpinnerGate` makes navigation *feel* responsive — it does **not** make
> the pages render faster. The items below are about cutting the actual render/compute cost.

## Candidate speed-ups

### 1. Scatter-point volume on the group pages (biggest remaining render cost)
`PairwiseScatter` plots **one SVG dot per session**, and each group page renders 3 scatters. With
thousands of sessions that's the dominant Recharts mount cost.
- **Downsample**: cap the number of plotted points (e.g. random/stratified sample) above some N.
  Trade-off: visual fidelity — fewer dots shown.
- **Canvas rendering**: draw dots to a `<canvas>` instead of SVG. Much faster, but loses Recharts
  tooltips + click-to-navigate-to-Session-View unless reimplemented by hand.

### 2. Shrink the main bundle (~613 kB / ~188 kB gzip)
Recharts is pulled into the **main** chunk because the eager Sanity landing page imports it
(`SessionCalendar`, `ConditionDistribution`). Lazy-loading those two charts would let Recharts
move into a deferred chunk and speed up initial load.
- Trade-off: a brief spinner on first paint of the landing page (mitigated by the existing gate).

### 3. Single-pass score/dispersion in the Raw sessions table
`buildSessionTableRows` still calls `computeSessionScore` **and** `computeSessionHitDispersion`
per session, and `computeSessionScorePerHit` (inside `variableRows`) re-walks the same hits for the
board-score sum. A combined single-pass helper returning `{ sum, avg, perHit, dispersion }` would
remove the duplicate per-hit board lookups. Lower priority now that virtualization removed the
render bottleneck — this is compute, which was never the freeze.

### 4. Off-main-thread parse / compute (only if proven necessary)
Restoring data from `localStorage` does a synchronous `JSON.parse` of a potentially large blob on
mount, and `buildSessionVariableRows` walks every hit. Moving either into a Web Worker would keep
the main thread free.
- Trade-off: real complexity — serialization overhead, the board `Map`s don't transfer cheaply,
  and functions can't cross the worker boundary. Only worth it if profiling shows parse/compute
  (not render) is the bottleneck.

### 5. Per-page compute is eager regardless of route
`variableRows` + `correlationMatrix` are computed in `App` on every data/`completeOnly` change even
when the user is on Sanity. They're memoized, so this is minor, but a route-aware lazy compute
would avoid the work until a group page (or Raw) is actually visited. Weigh against the current
benefit: navigating *to* those pages is instant because the data is already there.

## Suggested priority
1. Scatter downsampling/canvas (item 1) — the only remaining *render* cost of real size.
2. Bundle split for Sanity's Recharts (item 2) — cheap, helps cold load.
3. Everything else only if profiling still shows a problem.
