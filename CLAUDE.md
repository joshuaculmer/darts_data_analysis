# Darts Research — Data Analysis Tool

> **Rule for contributors and AI agents**: Update this file whenever a change is made or a feature is added. Keep the file structure tree, conventions, and findings sections current. A stale CLAUDE.md is worse than none.

## Visual Design Palette
All CSS, inline styles, and Recharts props must follow **`PALETTE.md`** at the project root. Do not introduce colors, fonts, or chart styling outside that document. See it for the full UI token set, graph rules, Okabe-Ito condition colors, and what to avoid.

## Project Purpose
A Vite/React/TypeScript single-page app for analyzing a 7-condition darts experiment studying how AI advice quality and trajectory affect player performance and trust.

## App Loading Flow
The app has three sequential gates before showing the dashboard:

1. **Upload screen** — user must provide both CSV files (game sessions + survey responses)
2. **Board loading screen** — app auto-fetches the board surfaces (Perlin or Gaussian) referenced in the session data
3. **Dashboard** — all data available, all charts active

Both CSVs are persisted in `localStorage` (`darts:sessions_csv`, `darts:survey_csv`) so the dashboard reloads automatically on page refresh without re-uploading. A red **Clear Data** button in the top-right of the header removes both keys and resets all app state to the upload screen.

The research dashboard is reorganized into three variable-centric **group pages** — Trust,
Performance, and Luck — each rendering its dimensions' by-condition/by-session/over-time charts,
within-group pairwise scatters, and the global cross-correlation heatmap (with that group's
rows/columns highlighted). The old single Trust page + its question-selector/graph-type toggle are
retired; each group renders its fixed dimensions directly. `trustQuestionId` still auto-selects the
first trust question on survey load — now only the Individual View consumes it.

## Data Sources

### CSV Files (user-uploaded at runtime)
Both must be loaded before the dashboard is accessible. Neither is bundled.

| CSV | Description |
|---|---|
| `game_sessions.csv` | One row per session; includes `execution_skill`, `games_played`, `ai_advice` (AI_Type 0–6), and a JSON-serialized `games` column |
| `post_session_survey.csv` | One row per survey submission; includes a JSON-serialized `responses` column (array of `{ questionId, value }`) |

Loaders: `src/loaders/loadData.ts` — `loadGameSessions()`, `loadSurveyResponses()`.

### Board Surfaces (auto-fetched)
The experiment uses two surface families in a **unified ID space** — the `board_id` in session data alone determines which family to fetch; there is no separate `surface_type` field.

| ID range | Family | Files | URL pattern |
|---|---|---|---|
| 0–99 | Perlin | `public/Perlin_Noise_Surfaces.ts/PerlinNoiseBoard{id}.json` | `/Perlin_Noise_Surfaces.ts/PerlinNoiseBoard{id}.json` |
| 100–199 | Gaussian | `public/Gaussian_Sum/GaussianSumBoard{id-100}.json` | `/Gaussian_Sum/GaussianSumBoard{id-100}.json` |

Each board is a 512×512 `number[][]`. Filenames have **no zero-padding**. Only boards referenced in the uploaded session data are fetched. Vite serves `public/` at root so the paths work identically in dev and production.

- Loader: `src/loaders/loadBoards.ts` — `loadBoards(sessions)` returns `Map<number, RewardSurface>`
- `boardUrl(id)` in that file handles the family routing; update it if the ID ranges or directory names change.

### EV Grids (auto-fetched)
Precomputed expected-value-per-hit grids, one per `(board_id, execution_skill)` pair used in the
experiment (276 pairs). Generated from `experiment_ev_grids.npz` (gitignored, at project root) by
`tools/convert_ev_grids.py` into `public/ev_grids/`:

- `ev_{board}_{skill}.bin` — 512×512 little-endian uint16, row-major in the app's `[x][y]`
  convention (the npz is stored transposed; the converter transposes once). EV = value × scale.
- `index.json` — `{ size, scale, pairs }`; the loader only fetches pairs present in both the
  uploaded sessions and this index.
- Loader: `src/loaders/loadEvGrids.ts` — `loadEvGrids(sessions)` returns `EvGrids`
  (`Map<string, Float32Array>` keyed by `evGridKey(boardId, skill)` = `"board:skill"`). Loaded in
  `App.tsx` alongside the boards behind the same loading gate.
- The grids store EV for a **10-hit game**; `getAimEV` divides by `EV_GRID_HITS` (10) to return
  per-hit EV.
- Lookup: `getAimEV(evGrids, boardId, skill, coord)` in `src/utils/aimingEV.ts` → EV per hit, or
  `null` when no grid covers the pair / coord is null / out of bounds. The old flat-8 placeholder
  is gone; **EV gap = scorePerHit − EV(actual aim)** and is `null` (not 0) when uncovered.

### Supabase Direct Fetch (alternative to CSV upload)
The header has a **Fetch Data** button that pulls both tables directly from Supabase instead of requiring manual CSV exports. This goes through a Supabase Edge Function rather than the public REST API.

**Security model:** Both tables have RLS enabled with no public-read policies — the anon key cannot read data. The Edge Function validates a password server-side against a Supabase secret, then queries using the service role key. The only value bundled in the frontend is `VITE_SUPABASE_URL` (the project URL, which is not sensitive).

**Flow:**
1. User clicks Fetch Data → password modal
2. Password sent as `x-fetch-password` header to `{SUPABASE_URL}/functions/v1/fetch-data`
3. Edge Function validates password, returns `{ sessions, survey }` JSON
4. Client maps rows to `ParsedGameSession[]` / `ParsedSurveyResponse[]` and stores under `darts:sessions_json` / `darts:survey_json` in localStorage

**Relevant files:**
- `supabase/functions/fetch-data/index.ts` — the Edge Function
- `supabase/functions/_shared/cors.ts` — CORS headers
- `src/loaders/fetchSupabase.ts` — `fetchData(password)`, `isSupabaseConfigured()`

**To redeploy:** see `SUPABASE_PRIVATE.md` (gitignored). The only GitHub Actions secret needed is `VITE_SUPABASE_URL`.

## Score Computation
Scores are computed from the board surfaces (Perlin or Gaussian depending on `board_id`), not from any field in the CSV.

```
gameScore   = sum of surface[floor(hit.x)][floor(hit.y)] for each hit in game.hits
sessionScore = { gameScores[], sum, avg } computed across all games in a session
participantTotalScore = sum of session sums across all sessions for a user
```

**Important**: hit coordinates (`Coord.x`, `Coord.y`) are floats — always `Math.floor` before indexing into the surface. Using raw float indices returns `undefined` from the array and silently scores 0.

`start` and `end` on `DartGameDTO` are **timestamps**, not scores. Do not use them for scoring.

## Key Experimental Design Facts
- `execution_skill` and `ai_advice` (AI condition) are **preset by admins** before each session — they are not outcomes. Do not frame charts of these as findings.
- The 8 AI conditions (`AI_Type` values 0–7): NONE, CORRECT, PLAUSIBLE, RANDOM, WRONG, BAD, GOOD_PLAUSIBLE, PLAUSIBLE_GOOD.
- GOOD_PLAUSIBLE and PLAUSIBLE_GOOD are ordering conditions — same advice quality, different trajectory. Comparing them is a key research question.
- Core research questions: Does AI condition affect game score? Does trust mediate performance? Does trust improve score?
- `MIN_SESSIONS_REQUIRED = 20` in `stats.ts` — change this single constant to update the completeness threshold everywhere. A participant is "complete" when `sessionCount === MIN_SESSIONS_REQUIRED && surveyCount === MIN_SESSIONS_REQUIRED`.

## Routing
The app uses **`react-router-dom` (`BrowserRouter`)**, wrapped in `main.tsx` with
`basename={import.meta.env.BASE_URL}` so deep links work under the GitHub Pages subpath.
Routes are declared in `App.tsx`: `/` → `/sanity`; `/sanity`, `/performance`, `/trust`,
`/luck`, `/raw`; `/individual/:uuid?` (single `:uuid` deep-links one participant, `?users=a,b`
filters several — set by the calendar day click); `/session` (browse) and
`/session/:uuid/:sessionIndex` (deep-link). Unknown paths redirect to `/sanity`.
Navbar items are `<NavLink>`s; scatter/calendar click-throughs use `useNavigate()`.
`SessionRoute`/`IndividualRoute` are module-scope wrappers that read route params so the
underlying stateful views don't remount. The data-loading gates (upload, board fetch) still
run inside `App` before the `<Routes>` render.

**Deployment (SPA fallback):** a `spa-404-fallback` Vite plugin in `vite.config.ts` copies
`dist/index.html` → `dist/404.html` on build, so a hard refresh of a client route resolves to
the SPA shell on GitHub Pages. The deploy workflow uploads all of `dist/`, so no workflow change
is needed.

## Navigation Structure
Top navbar sections (each a route). The three research groups (Trust/Performance/Luck) are
variable-centric and share the same building blocks. See `PLANNING.md` for the chart roadmap.

| Section | Key Components |
|---|---|
| Sanity Checks | KpiCards, SessionCalendar, ConditionDistribution |
| Game Performance (`/performance`) | `PerformanceGroup`: scorePerHit by condition + proxOptimal by condition (VariableByCondition), satisfied dimension (SurveyDimensionCharts), within-group pairwise scatters, global heatmap (Performance highlighted) |
| Trust & Influence (`/trust`) | `TrustGroup`: trust + influence dimensions (SurveyDimensionCharts), proxAI by condition, within-group pairwise scatters, global heatmap (Trust highlighted) |
| Luck (`/luck`) | `LuckGroup`: luck dimension, dispersion + evGap by condition, within-group pairwise scatters, global heatmap (Luck highlighted). |
| Individual View | IndividualView (participant dropdown + wholistic score graph with toggleable per-dimension survey overlays [trust/influence/satisfied/luck] + game breakdown) |
| Session View | SessionView — participant + session pills in **chronological** order (`created_at`); session metadata table + per-game table with expandable hit rows, board ID, board seed (if present in game JSON), per-game scorePerHit / dispersion / EV-gap, and EV of the actual / suggested / optimal aim. Scatter navigation uses global row index into `filteredSessions`; pills remap to the same session after sort. |
| Raw Data | Coming soon (filterable/sortable tables) |

The six trust charts (`TrustByCondition`, `TrustBySession`, `TrustOverTime`, `TrustVsScore`,
`TrustVsTime`, `TrustVsProximity`) are now **dimension-agnostic**: they take `metricLabel` +
`scaleLabels` (from `SURVEY_DIMENSIONS`) instead of the old `likertScale` union, so the same
component renders trust, influence, satisfaction, or luck.

All sections except Raw Data respect the **Complete Participants** toggle (passed via `filteredSessions` / `filteredSurveyResponses`).

## File Structure

```
src/
├── App.tsx                          # Top-level: routing, CSV upload, board loading, memos
├── App.css
├── main.tsx
│
├── types/
│   ├── dart.ts                      # Coord, DartGameDTO, Game_SessionDTO, AI_Type, RewardSurface
│   ├── survey.ts                    # Question, Answer, PostSessionSurveyResponseDTO
│   └── db.ts                        # GameSessionRow, SurveyResponseRow (raw CSV shapes)
│
├── loaders/
│   ├── loadData.ts                  # ParsedGameSession, ParsedSurveyResponse, CSV parsers
│   ├── loadData.test.ts
│   ├── loadBoards.ts                # loadBoards(sessions) → Map<number, RewardSurface>
│   ├── loadBoards.test.ts
│   ├── loadEvGrids.ts               # loadEvGrids(sessions) → EvGrids (Map<"board:skill", Float32Array>);
│   │                                #   fetches public/ev_grids/*.bin per (board, skill) pair in the data
│   └── loadEvGrids.test.ts
│
├── data/
│   ├── Perlin_Aiming.json           # Optimal aiming coords for Perlin boards (IDs 0–99);
│   │                                #   shape: [boardId][skillRowIdx][x, y] where skillRowIdx = (skill−5)/5
│   └── Gaussian_Aiming.json         # Optimal aiming coords for Gaussian boards (IDs 100–199);
│                                    #   inner index = boardId − 100; same shape as Perlin
│
├── utils/
│   ├── stats.ts                     # computeKpis, groupSessionsByDate, groupParticipantsByDate,
│   │                                #   countByCondition, computeConditionStats, MIN_SESSIONS_REQUIRED
│   ├── stats.test.ts
│   ├── stats.phase2.test.ts
│   ├── scoreStats.ts                # gameScore, computeSessionScore, computeAllSessionScores,
│   │                                #   computeParticipantTotalScores, computeScoreByCondition,
│   │                                #   computeScoreVsSkillPoints, computeProximityVsScorePoints,
│   │                                #   computeGameProximity, computeGameDurationSecs,
│   │                                #   gameScorePerHit, computeSessionScorePerHit (per-hit canonical
│   │                                #     score — raw total is confounded by dynamic hit count 1/3/5/10),
    │   │                                #   computeSessionScoreTotalPerHit (total score ÷ total hit count —
    │   │                                #     hit-weighted per-hit; used by Individual View KPI + timeline),
│   │                                #   computeGameHitDispersion/computeSessionHitDispersion (Dispersion
│   │                                #     {mean,std} of hits around actual aim),
│   │                                #   computeGameEvGap/computeSessionEvGap (per-hit scorePerHit −
│   │                                #     EV(actual aim) from EvGrids; null when no grid covers the game),
│   │                                #   SessionScore, ParticipantScore, ProximityScorePoint, Dispersion
│   │                                #   ScoreSkillPoint includes user_uuid + sessionIndex for click-to-navigate
│   ├── scoreStats.test.ts
│   ├── surveyScales.ts              # ORDINAL_SCALES — single source for all ordinal label→score
│   │                                #   mappings. Update here when the instrument changes.
│   │                                #   Current instrument: trust/influence/satisfied use the
│   │                                #   5-point agreement Likert; luck uses Very Unlucky..Very Lucky.
│   │                                #   (Performance Very Poor..Very Good scale is RETIRED.)
│   │                                #   SURVEY_DIMENSIONS registry maps questionId → {label, group
│   │                                #   (trust|performance|luck), scaleLabels}; getDimension/
│   │                                #   getScaleLabels/formatScaleValue are the display helpers.
│   │                                #   DIMENSION_COLORS/getDimensionColor give each dimension an
│   │                                #   Okabe-Ito line color (Individual timeline overlay).
│   │                                #   (Deprecated trust|performance LikertScale shims are REMOVED.)
│   ├── surveyStats.ts               # joinSessionsWithSurvey, computeTrustByCondition,
│   │                                #   computeTrustOverTime, computeTrustVsScorePoints,
│   │                                #   computeTrustVsTimePoints, computeTrustVsProximityPoints
│   ├── surveyStats.test.ts
│   ├── individualStats.ts           # getParticipantList, computeIndividualTimeline
│   │                                #   (score is per-hit [total ÷ hit count] + per-session surveyValues keyed by SURVEY_DIMENSIONS
│   │                                #    — trust/influence/satisfied/luck; retired "performance" dropped),
│   │                                #   computeIndividualKpis, computeGameBreakdown,
│   │                                #   chronologicalParticipantSessionEntries (Session View order + navigate)
│   ├── individualStats.test.ts
│   ├── aimingLookup.ts              # getOptimalAimingCoord(boardId, executionSkill) → canvas {x,y} | null
│   │                                #   routes to Perlin (0–99) or Gaussian (100–199) JSON;
│   │                                #   JSON [a,b] → canvas x=b, y=a (matches AI_Correct toCoord convention)
│   ├── aimingEV.ts                  # getAimEV(evGrids, boardId, skill, coord) → EV per hit | null;
│   │                                #   real lookup into the precomputed EV grids (see EV Grids section)
│   ├── aimingEV.test.ts
│   ├── variables.ts                 # Unified 9-variable session-level set (Trust/Performance/Luck):
│   │                                #   SessionVariableRow, buildSessionVariableRows(joined, boards),
│   │                                #   VARIABLES registry {key,label,group,accessor,format} + VARIABLE_KEYS,
│   │                                #   computeVariableByCondition(rows, key) → mean±CI95 per AI condition
│   ├── variables.test.ts
│   ├── correlation.ts               # spearman(xs, ys) pairwise-complete → {r, n};
│   │                                #   computeCorrelationMatrix(rows, keys) → CorrelationCell[][]
│   └── correlation.test.ts
│
└── components/
    ├── sanity/
    │   ├── KpiCards.tsx             # 5 KPIs: unique participants, complete participants,
    │   │                            #   avg sessions/participant, avg time/session, avg total time
    │   ├── SessionCalendar.tsx      # GitHub-style heatmap of participants per day
    │   └── ConditionDistribution.tsx
    │
    ├── correlation/                  # Shared building blocks for the group pages
    │   ├── CorrelationHeatmap.tsx    # Generic Spearman heatmap; diverging palette; highlightGroup; onCellClick
    │   ├── PairwiseScatter.tsx       # Generic x-var vs y-var scatter (VARIABLES accessors); dot → /session nav
    │   ├── VariableByCondition.tsx   # Generic mean±CI95 dot chart for continuous vars by AI condition
    │   ├── SurveyDimensionCharts.tsx # Renders by-condition/by-session/over-time for one survey dimension
    │   └── GlobalHeatmapSection.tsx  # CorrelationHeatmap + click-to-scatter drilldown
    │
    ├── performance/
    │   ├── PerformanceGroup.tsx      # /performance page (scorePerHit, satisfied, proxOptimal + heatmap)
    │   ├── ScoreByCondition.tsx      # (legacy) Mean session-avg score ± CI95 per condition — superseded by per-hit VariableByCondition
    │   ├── ScoreVsSkillScatter.tsx   # (legacy) not currently routed
    │   ├── ProximityVsScore.tsx      # (legacy) not currently routed
    │   └── OptimalProximityVsScore.tsx # (legacy) not currently routed
    │
    ├── luck/
    │   └── LuckGroup.tsx             # /luck page (luck, dispersion, evGap + heatmap; EV gap is placeholder)
    │
    ├── trust/
    │   ├── TrustGroup.tsx            # /trust page (trust + influence dims, proxAI, pairwise, heatmap)
    │   ├── TrustByCondition.tsx      # Mean rating by condition for ANY dimension (metricLabel+scaleLabels); Dot+CI/Median+IQR/Stacked Likert
    │   ├── TrustBySession.tsx        # Mean rating by participant session number for ANY dimension
    │   ├── TrustOverTime.tsx         # Rating over session index for ANY dimension
    │   ├── TrustVsScore.tsx          # Rating vs avg score; click → per-game score bars; needs boards prop
    │   ├── TrustVsTime.tsx           # Rating vs avg game duration; click → per-game duration bars
    │   └── TrustVsProximity.tsx      # Rating vs avg proximity to AI suggestion; click → per-game proximity bars
    │
    ├── individual/
    │   ├── IndividualView.tsx       # Parent: participant selector, wires all sub-components
    │   ├── IndividualTimeline.tsx   # Wholistic Individual Graph (score + any survey dimensions)
    │   │                            #   per-dimension toggles (trust/influence/satisfied/luck, only
    │   │                            #   those with data), each a DIMENSION_COLORS line; shared right
    │   │                            #   axis shows labels when enabled dims share one scale, else 1–5
    │   ├── GameBreakdown.tsx        # Stub — renders session avg; game-level bars need raw session passed in
    │   ├── ConditionExposure.tsx
    │   ├── ParticipantKpiCards.tsx
    │   └── SurveyResponseTable.tsx
    │
    ├── session/
    │   └── SessionView.tsx          # Participant + session dropdowns; metadata table + games table
    │                                #   (click row → expands per-hit coordinates + individual hit scores;
    │                                #    game detail shows per-game scorePerHit, dispersion mean±std,
    │                                #    and EV gap [placeholder EV until the EV JSON lands])
    │                                #   Navigated to automatically when a scatter point is clicked
    │
    └── raw/
        ├── SessionsTable.tsx        # Sortable/filterable sessions table; shows games_played vs actual array length (red if mismatch); CSV export; uses unfiltered sessions.
        │                            #   Includes extrapolated session-level columns via buildSessionTableRows (pure, exported, tested):
        │                            #   avg hits/game, total score, avg score/game, scorePerHit, proxAI, proxOptimal, dispersion μ/σ,
        │                            #   EV gap (from EV grids; blank when uncovered), and joined survey trust/influence/satisfied/luck. CSV export includes all.
        └── SurveyTable.tsx          # Sortable/filterable survey table; dynamic question columns; CSV export

public/
├── Perlin_Noise_Surfaces.ts/        # 100 board JSON files (PerlinNoiseBoard0.json … PerlinNoiseBoard99.json); board_id 0–99
├── Gaussian_Sum/                    # 100 board JSON files (GaussianSumBoard0.json … GaussianSumBoard99.json); board_id 100–199 → file index = id−100
├── ev_grids/                        # 276 EV grids (ev_{board}_{skill}.bin, uint16) + index.json; from tools/convert_ev_grids.py
├── favicon.svg
└── icons.svg
```

## Sanity Check KPIs
Defined in `computeKpis(sessions, surveyResponses)` in `stats.ts`:

| KPI | Definition |
|---|---|
| Unique Participants | Distinct `user_uuid` values across all sessions |
| Complete Participants | Users where `sessionCount === MIN_SESSIONS_REQUIRED && surveyCount === MIN_SESSIONS_REQUIRED` |
| Avg Sessions / Participant | Total sessions ÷ unique participants |
| Avg Time / Session | Mean inter-session gap (consecutive `created_at` diffs) for complete participants only |
| Avg Total Time | Per complete user: `avgGap × sessionCount` (treats each session including the first as one avg-gap unit), then averaged |

## ChartCard — Reusable Chart Wrapper
All chart components use `<ChartCard title="...">` from `src/components/ChartCard.tsx` instead of a plain `<div className="chart-card">`. This provides:
- **Collapse toggle** (▲/▼ button in the header) — hides the chart body while keeping the title visible
- **PNG download** (↓ button) — serializes the first SVG within the card to PNG at 2× resolution with dark background
- **Drill-down cards** use `onClose` prop instead of collapse, showing a × button

PNG export selects the largest non-button SVG in the card so legend marker SVGs are not exported by mistake.

## Tech Stack
- **Vite + React + TypeScript**
- **Recharts** — primary charting library
- **PapaParse** — CSV parsing (installed; handles JSON column strings)
- **TanStack Table v8** — sortable/filterable tables (planned)
- **Tailwind CSS** — styling (planned; currently using `App.css`)

## Development Process — TDD
Follow red → green development for all new logic:
1. **Write a failing test first.** Run `npx vitest run` and confirm it fails before writing any implementation.
2. **Implement until the test passes.** Do not add more code than the test requires.
3. **Use tests to validate, not just confirm.** A test that only passes trivially (e.g. checks that a function returns something) is not a test.

Test files live alongside source files (`foo.ts` / `foo.test.ts`). Existing test coverage lives in `stats.test.ts`, `scoreStats.test.ts`, `surveyStats.test.ts`, `individualStats.test.ts`, and the loader tests — extend those when touching the corresponding utils.

UI components (`ChartCard`, chart components) currently have no tests. If adding new component logic (e.g. download behaviour, computed props), write unit tests for the underlying util function rather than the component itself.

## Conventions
- Chart components live in `src/components/<section>/`, one folder per navbar section: `sanity/`, `performance/`, `trust/`, `individual/`. No `phase1/` or `phase2/` folders.
- Stats/aggregation logic lives in `src/utils/` — not inside components. Use the most specific file (`scoreStats.ts` for scores, `surveyStats.ts` for trust/survey joins, `stats.ts` for general session-level aggregations).
- `safeParseJSON<T>(value, fallback)` in `loadData.ts` is the standard way to parse JSON columns from CSV rows.
- Survey `questionId` strings are treated dynamically — do not hardcode them. The trust question is selected at runtime via `TrustQuestionSelector`.
- All score-producing functions take `boards: Map<number, RewardSurface>` as a parameter — do not pass raw game arrays and expect scores to be computed without a surface.
- Test files live alongside source files (`foo.ts` / `foo.test.ts`). Run with `npx vitest run`.
