# Plan — Survey Re-parse, Routed Restructure, and Cross-Correlation

Status: **DRAFT for review** (2026-06-02)

## Goal
The post-session survey changed to four required questions — `trust`, `influence`,
`satisfied` (all 5-point agreement Likert) and `luck` (Very Unlucky…Very Lucky). The old
"performance perception" (Very Poor…Very Good) question is **fully retired**. This plan:

1. Re-parses the new survey instrument correctly (incl. the new `luck` scale).
2. Replaces the binary trust/performance scale concept with a **variable registry**.
3. Adds **real client-side routing** (react-router-dom) so each section is a shareable URL.
4. Reorganizes the dashboard into three research groups — **Trust / Performance / Luck** —
   each variable-centric, with within-group pairwise views.
5. Adds a **global cross-correlation heatmap** across all variables, click-to-scatter.
6. Adds extrapolated metrics (hit dispersion, EV-gap placeholder) and surfaces them in Raw Data.
7. Keeps Sanity Checks, Individual View, Session View, Raw Data.

## New survey instrument (source of truth)
```
trust     — "I trusted this AI's recommendations…"            five_point_Likert_Scale (agreement)
influence — "My choices were influenced by this AI's…"        five_point_Likert_Scale (agreement)
satisfied — "I'm satisfied with where I chose to aim."        five_point_Likert_Scale (agreement)
luck      — "How much do you feel your score was impacted by luck?"
             ["Very Unlucky","Unlucky","Little or no impact","Lucky","Very Lucky"]
```
`five_point_Likert_Scale` = ["Strongly Disagree ", "Disagree", "Neutral", "Agree", "Strongly Agree"]
(note the trailing space on the first label — `getAnswerValue` already `.trim()`s + lowercases, so this is safe).

## Locked decisions (from clarifying Q&A)
- **EV metric: deferred with placeholder.** A future JSON (EV per board × aim location × execution
  skill) will be loaded later. For now `getAimEV()` returns a flat **8 per hit**, structured so the
  JSON swaps in without touching call sites. `evGap = actualScore − EV`.
- **Routing: `react-router-dom` with `BrowserRouter`** + GitHub Pages SPA fallback
  (`dist/index.html` → `dist/404.html` so deep-link refreshes resolve to the SPA shell). **Confirmed.**
- **EV stub: confirmed.** Render `evGap` with the placeholder value; build `getAimEV()` as a
  replaceable getter. **Confirmed.**
- **Correlation scope: global** across all variables (one unified session-level row set),
  **plus** a focused within-group pairwise view for each variable in its group page.
- **Correlation UI: heatmap matrix + click-to-scatter.**

## Experiment-restructure facts (incorporated)
- **Hit count is now dynamic per game**, typically 1, 3, 5, or 10 (`game.hits.length`). There is one
  `actual_aiming_coord` per game; "hits" are repeated throws at that aim. This **confounds raw score**
  (sum over hits scales with hit count) → see per-hit normalization below.
- **AI condition rename:** `GOOD_BAD` → `GOOD_PLAUSIBLE` ("Good→Plausible"), `BAD_GOOD` →
  `PLAUSIBLE_GOOD` ("Plausible→Good"). Integer values **stay 5 and 6** (verify ints didn't swap);
  semantic/label rename only, no data migration.
- **Shelved for v2:** modeling the effect of `ai_type` on each variable (e.g. condition as a factor in
  the correlations / per-condition variable comparisons). Not in this refactor.

## Decisions made in this plan (reasonable defaults — flag if you disagree)
- **Score is normalized per hit** for all charting/correlation: `scorePerHit = gameScore / hits.length`,
  session-aggregated as the mean per-hit score. Because hit count is now dynamic (1/3/5/10), raw
  summed score is confounded by how many throws a game allowed. `evGap` is likewise per-hit
  (`scorePerHit − 8`). Raw Data keeps the un-normalized total score column too.
- **Correlation unit = one row per session** (survey is per-session; scores/proximities/dispersion
  averaged across the session's games). Mixed ordinal+continuous data.
- **Correlation coefficient = Spearman rank** (robust to ordinal Likert + nonlinearity);
  pairwise-complete (drop rows where either variable is null, e.g. proxAI in NONE condition).
  Show `n` alongside `r` in the heatmap cell tooltip.
- **No more dimension toggle.** Each group page renders all its survey dimensions' charts directly
  (only 1 survey item per group except Trust has trust+influence), instead of the old Trust/Perf tab.
- **Routing flavor = `BrowserRouter` + GitHub Pages SPA fallback** (copy `index.html`→`404.html` at
  build, set Vite `base`). See Deployment Notes — if we'd rather not touch the deploy, fall back to `HashRouter`.
- **Heatmap palette = new diverging scale** added to `PALETTE.md` (negative=vermillion `#D55E00`,
  zero=neutral `#9ca3af`, positive=teal `#009E73`), reusing existing low→high semantics.

## The unified variable set (9 variables, session-level)
| Key | Group | Source | Notes |
|---|---|---|---|
| `trust` | Trust | survey | agreement 1–5 |
| `influence` | Trust | survey | agreement 1–5 |
| `proxAI` | Trust | `computeGameProximity` avg | dist actual→AI suggestion; null if no AI |
| `satisfied` | Performance | survey | agreement 1–5 |
| `scorePerHit` | Performance | NEW `gameScore / hits.length`, session-avg | per-hit so dynamic hit count (1/3/5/10) doesn't confound |
| `proxOptimal` | Performance | `computeGameOptimalProximity` avg | dist actual→optimal aim |
| `luck` | Luck | survey | Very Unlucky(1)…Very Lucky(5) |
| `dispersion` | Luck | NEW `computeGameHitDispersion` | mean (and std) of hit→actual_aiming_coord |
| `evGap` | Luck | NEW `computeGameEvGap` | per-hit: `scorePerHit − EV(placeholder 8)` |

---

# Implementation phases (TDD throughout: red → green)

## Phase 0 — AI condition rename (`dart.ts`, `stats.ts`, docs, tests)
1. Rename enum keys `GOOD_BAD`→`GOOD_PLAUSIBLE`, `BAD_GOOD`→`PLAUSIBLE_GOOD` in `dart.ts`
   (values **stay 5 and 6** — verify against a real data row that ints didn't swap).
2. Update `AI_TYPE_LABELS` ("Good→Plausible", "Plausible→Good") and keep the existing colors
   (`#009E73`, `#56B4E9`) on the renamed keys in `stats.ts`.
3. Update the 4 test files referencing the old names, plus `CLAUDE.md`, `PALETTE.md`, `PLANNING.md`.
4. `npx vitest run` green before moving on.

## Phase 1 — Parsing & scale foundation (`surveyScales.ts`)
1. Add luck labels to `ORDINAL_SCALES`: `very unlucky`→1, `unlucky`→2, `little or no impact`→3,
   `lucky`→4, `very lucky`→5.
2. **Remove** the retired performance scale labels (`very poor`…`very good`) and the
   `"trust" | "performance"` `LikertScale` union + `PERFORMANCE_LIKERT_LABELS` +
   `inferLikertScaleFromQuestionId`.
3. Introduce a **survey dimension registry**:
   ```ts
   interface SurveyDimension { id: string; label: string; group: VariableGroup;
                               scaleLabels: Record<number,string>; }
   export const SURVEY_DIMENSIONS: Record<string, SurveyDimension>  // keyed by questionId
   ```
   with `AGREEMENT_LABELS` (Strongly Disagree…Strongly Agree) and `LUCK_LABELS`.
4. Generalize `formatLikertValue(value, scaleLabels)` to take an explicit label map (no more scale union).
5. Tests: `surveyScales.test.ts` — luck parsing via `getAnswerValue`, registry lookups, formatting.

## Phase 2 — New metrics (`scoreStats.ts` + new `aimingEV.ts`) — TDD
1. `gameScorePerHit(game, surface)` = `gameScore / max(1, hits.length)`. Add a session aggregate
   (mean per-hit score across games) and use it as the canonical `scorePerHit` variable. Keep existing
   `gameScore`/`computeSessionScore` (raw total) for Raw Data and back-compat.
2. `computeGameHitDispersion(game)` → `{ mean, std }` of Euclidean dist from each hit to
   `actual_aiming_coord`. Session aggregate = mean over games.
3. `aimingEV.ts`: `getAimEV(boardId, aimCoord, executionSkill): number` → placeholder `8` per hit,
   documented as a replaceable stub for the forthcoming EV JSON (mirror `aimingLookup.ts` routing
   shape so the JSON drops in without touching call sites).
4. `computeGameEvGap(game, surface)` = `gameScorePerHit(game,surface) − getAimEV(...)` (per-hit gap).
5. Tests in `scoreStats.test.ts`: per-hit score with varying hit counts, dispersion (known coords),
   evGap (placeholder arithmetic).

## Phase 3 — Variable + correlation engine (new `utils/variables.ts`, `utils/correlation.ts`) — TDD
1. `buildSessionVariableRows(joined, boards): SessionVariableRow[]` — one row/session with all 9
   variables (nullable where undefined), plus `user_uuid`, `sessionIndex`, `ai_advice` for coloring/nav.
2. `VARIABLES` registry: `{ key, label, group, accessor, format }` — single source driving heatmap,
   group pages, and Raw Data columns.
3. `correlation.ts`: `spearman(xs, ys)` (pairwise-complete) and
   `computeCorrelationMatrix(rows, keys) → { key i, key j, r, n }[][]`.
4. Tests: `variables.test.ts` (row assembly, null handling), `correlation.test.ts`
   (monotonic→r≈1, anti→r≈−1, independent→r≈0, n counting).

## Phase 4 — Routing (`react-router-dom`)
1. `npm i react-router-dom`. Wrap app in `<BrowserRouter>` in `main.tsx`.
2. Routes (gates for upload/boards still run inside the layout route):
   - `/` → redirect `/sanity`
   - `/sanity`, `/trust`, `/performance`, `/luck`, `/individual`, `/raw`
   - `/individual/:uuid?`
   - `/session/:uuid/:sessionIndex`
3. Convert `NAV_ITEMS` buttons → `<NavLink>` (keep `nav-tab` / `nav-tab--active` classes).
4. Replace `setActiveSection(...)` navigation calls (scatter click-through, calendar day click)
   with `useNavigate()`. Replace `sessionViewParticipant/Index` + `individualFilterUuids` state with
   route params / query where natural; keep memos lifted in a shared layout component.
5. Deployment fallback step (see Deployment Notes).

## Phase 5 — Section restructure
**Folder moves:** keep `sanity/`, `individual/`, `session/`, `raw/`. Rename research grouping to
`trust/`, `performance/`, `luck/`, and add shared `correlation/`.

**Generalize existing trust charts** (`TrustByCondition`, `TrustBySession`, `TrustOverTime`,
`TrustVsScore`, `TrustVsTime`, `TrustVsProximity`): they already take a `questionId`; replace the
`likertScale` prop with `scaleLabels` + axis title from the dimension registry so they work for any
dimension. These become the per-dimension "by condition / by session / over time" charts.

**Group pages** (each a route):
- **Trust** (`/trust`): trust + influence by-condition/by-session/over-time charts; proxAI vs condition;
  within-group pairwise scatters (trust↔influence, trust↔proxAI, influence↔proxAI);
  global heatmap with Trust rows highlighted.
- **Performance** (`/performance`): `ScoreByCondition` (switched to per-hit score), `ProximityVsScore`,
  `OptimalProximityVsScore`; satisfied by-condition; within-group pairwise (satisfied↔scorePerHit,
  satisfied↔proxOptimal, scorePerHit↔proxOptimal); global heatmap (Performance highlighted).
- **Luck** (`/luck`): luck by-condition; dispersion-by-condition; evGap-by-condition (placeholder
  note shown since EV is stubbed); within-group pairwise (luck↔dispersion, luck↔evGap,
  dispersion↔evGap); global heatmap (Luck highlighted).

**Shared correlation components** (`components/correlation/`):
- `CorrelationHeatmap.tsx` — generic; props: matrix, variable metadata, `highlightGroup?`, `onCellClick`.
  Diverging palette from PALETTE.md; cell tooltip shows `r` and `n`.
- `PairwiseScatter.tsx` — generic x-var vs y-var scatter, colored by AI condition, dot click →
  `useNavigate('/session/:uuid/:idx')`. Reuses `ChartCard`.

## Phase 6 — Individual & Session views
- `IndividualTimeline`: drop the retired "performance" series; allow selecting which survey
  dimension(s) to overlay (trust/influence/satisfied/luck) using the dimension registry + shared
  right-axis Likert mapping.
- `SessionView`: no functional change required; verify it still builds with route params and that the
  per-game table can optionally show dispersion / evGap per game (nice-to-have).

## Phase 7 — Raw Data export with extrapolated variables
- `SessionsTable`: add computed columns from `buildSessionVariableRows` — `scorePerHit`, raw total
  `score`, avg hit count, `proxAI`, `proxOptimal`, `dispersionMean`, `dispersionStd`, `evGap`, and
  survey `trust/influence/satisfied/luck`. CSV export includes them (user explicitly wants extrapolated
  vars downloadable). Note EV-gap is a placeholder until the EV JSON lands.

## Phase 8 — Palette + docs
- `PALETTE.md`: add the diverging correlation heatmap scale section.
- `CLAUDE.md`: update navigation table (Trust/Performance/Luck), file tree (new utils/components/
  routing), survey-scale notes (luck added, performance retired), and the score/metric section
  (dispersion, EV placeholder).
- `PLANNING.md`: update the per-section chart roadmap.

---

## Deployment Notes (routing) — confirmed approach
`BrowserRouter` on static hosting (GitHub Pages) 404s on hard-refresh of `/trust` etc. **Mitigation
(confirmed): copy `dist/index.html` → `dist/404.html`** in the build so the SPA shell is served for
unknown paths, and set Vite `base` to match the deploy path. Wire the copy into the build script (e.g.
a postbuild step or a tiny Vite plugin) and verify the GitHub Actions workflow publishes `404.html`.

## Risks / watch-list
- `getAnswerValue` returns `null` for unknown labels — verify real exported CSV label spelling matches
  `ORDINAL_SCALES` keys exactly (esp. "Little or no impact").
- Pairwise-complete correlation: `proxAI` is null for NONE condition → those sessions drop from any
  pair involving `proxAI`; surface `n` so this is visible, don't silently imply full-sample r.
- EV-gap is a flat placeholder — every session's evGap == scorePerHit − 8; its correlations are
  real but only meaningful once the EV JSON replaces the stub. Label clearly in UI.
- Dynamic hit count: any chart still using raw summed score will be biased by hit count. Audit all
  score consumers when introducing `scorePerHit`; the Performance group + correlations must use per-hit.

## Suggested commit sequence
1. Phase 0 (AI rename) · 2. Phase 1 (scales) · 3. Phase 2 (metrics) · 4. Phase 3 (variables+
correlation engine) · 5. Phase 4 (routing) · 6. Phase 5 (groups + correlation UI) ·
7. Phase 6 (individual/session) · 8. Phase 7 (raw export) · 9. Phase 8 (palette + docs).
