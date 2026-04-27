# Darts Research — Data Analysis Tool

> **Rule for contributors and AI agents**: Update this file whenever a change is made or a feature is added. Keep the file structure tree, conventions, and findings sections current. A stale CLAUDE.md is worse than none.

## Visual Design Palette
All CSS, inline styles, and Recharts props must follow **`PALETTE.md`** at the project root. Do not introduce colors, fonts, or chart styling outside that document. See it for the full UI token set, graph rules, Okabe-Ito condition colors, and what to avoid.

## Project Purpose
A Vite/React/TypeScript single-page app for analyzing a 7-condition darts experiment studying how AI advice quality and trajectory affect player performance and trust.

## App Loading Flow
The app has three sequential gates before showing the dashboard:

1. **Upload screen** — user must provide both CSV files (game sessions + survey responses)
2. **Board loading screen** — app auto-fetches the Perlin noise board surfaces referenced in the session data
3. **Dashboard** — all data available, all charts active

Both CSVs are persisted in `localStorage` (`darts:sessions_csv`, `darts:survey_csv`) so the dashboard reloads automatically on page refresh without re-uploading. A red **Clear Data** button in the top-right of the header removes both keys and resets all app state to the upload screen.

The trust question selector auto-selects the first available question on survey load.

## Data Sources

### CSV Files (user-uploaded at runtime)
Both must be loaded before the dashboard is accessible. Neither is bundled.

| CSV | Description |
|---|---|
| `game_sessions.csv` | One row per session; includes `execution_skill`, `games_played`, `ai_advice` (AI_Type 0–6), and a JSON-serialized `games` column |
| `post_session_survey.csv` | One row per survey submission; includes a JSON-serialized `responses` column (array of `{ questionId, value }`) |

Loaders: `src/loaders/loadData.ts` — `loadGameSessions()`, `loadSurveyResponses()`.

### Perlin Noise Board Surfaces (auto-fetched)
- 100 boards (0–99), each a 512×512 `number[][]`
- Stored in `public/Perlin_Noise_Surfaces.ts/` as `PerlinNoiseBoard0.json` through `PerlinNoiseBoard99.json` — **no zero-padding** in filenames
- Fetched at runtime from `/Perlin_Noise_Surfaces.ts/PerlinNoiseBoard{id}.json` (Vite serves `public/` at root; in dev this is localhost, in production it's the deployed host — both correct)
- Only boards referenced in the uploaded session data are fetched
- Loader: `src/loaders/loadBoards.ts` — `loadBoards(sessions)` returns `Map<number, RewardSurface>`

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
Scores are computed from the Perlin noise surfaces, not from any field in the CSV.

```
gameScore   = sum of surface[floor(hit.x)][floor(hit.y)] for each hit in game.hits
sessionScore = { gameScores[], sum, avg } computed across all games in a session
participantTotalScore = sum of session sums across all sessions for a user
```

**Important**: hit coordinates (`Coord.x`, `Coord.y`) are floats — always `Math.floor` before indexing into the surface. Using raw float indices returns `undefined` from the array and silently scores 0.

`start` and `end` on `DartGameDTO` are **timestamps**, not scores. Do not use them for scoring.

## Key Experimental Design Facts
- `execution_skill` and `ai_advice` (AI condition) are **preset by admins** before each session — they are not outcomes. Do not frame charts of these as findings.
- The 7 AI conditions (`AI_Type` values 0–6): NONE, CORRECT, RANDOM, WRONG, BAD, GOOD_BAD, BAD_GOOD.
- GOOD_BAD and BAD_GOOD are ordering conditions — same advice quality, different trajectory. Comparing them is a key research question.
- Core research questions: Does AI condition affect game score? Does trust mediate performance? Does trust improve score?
- `MIN_SESSIONS_REQUIRED = 5` in `stats.ts` — change this single constant to update the completeness threshold everywhere. A participant is "complete" when `sessionCount === MIN_SESSIONS_REQUIRED && surveyCount === MIN_SESSIONS_REQUIRED`.

## Navigation Structure
Top navbar with six sections. See `PLANNING.md` for the full chart roadmap per section.

| Section | Key Components |
|---|---|
| Sanity Checks | KpiCards, SessionCalendar, ConditionDistribution |
| Game Performance | ScoreByCondition (mean ± CI95 per condition), ScoreVsSkillScatter (click → Session View), TrustVsScore (click → game scores), ProximityVsScore (click → game proximity/score) |
| Trust & Influence | TrustQuestionSelector, TrustByCondition, TrustOverTime, TrustVsScore, TrustVsTime, TrustVsProximity |
| Individual View | IndividualView (participant dropdown + timeline + breakdown) |
| Session View | SessionView — participant + session dropdowns; session metadata table + per-game table with expandable hit rows |
| Raw Data | Coming soon (filterable/sortable tables) |

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
│   └── loadBoards.test.ts
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
│   │                                #   SessionScore, ParticipantScore, ProximityScorePoint
│   │                                #   ScoreSkillPoint includes user_uuid + sessionIndex for click-to-navigate
│   ├── scoreStats.test.ts
│   ├── surveyScales.ts              # ORDINAL_SCALES — single source for all ordinal label→score
│   │                                #   mappings (Likert, performance scale, etc.). Update here
│   │                                #   when the survey instrument changes.
│   ├── surveyStats.ts               # joinSessionsWithSurvey, computeTrustByCondition,
│   │                                #   computeTrustOverTime, computeTrustVsScorePoints,
│   │                                #   computeTrustVsTimePoints, computeTrustVsProximityPoints
│   ├── surveyStats.test.ts
│   ├── individualStats.ts           # getParticipantList, computeIndividualTimeline,
│   │                                #   computeIndividualKpis, computeGameBreakdown
│   └── individualStats.test.ts
│
└── components/
    ├── sanity/
    │   ├── KpiCards.tsx             # 5 KPIs: unique participants, complete participants,
    │   │                            #   avg sessions/participant, avg time/session, avg total time
    │   ├── SessionCalendar.tsx      # GitHub-style heatmap of participants per day
    │   └── ConditionDistribution.tsx
    │
    ├── performance/
    │   ├── ScoreByCondition.tsx      # Mean score ± CI95 per AI condition (bar chart) — primary research finding
    │   ├── ScoreVsSkillScatter.tsx
    │   └── ProximityVsScore.tsx      # Proximity vs score scatter; click → per-game scatter breakdown
    │
    ├── trust/
    │   ├── TrustQuestionSelector.tsx
    │   ├── TrustByCondition.tsx
    │   ├── TrustOverTime.tsx
    │   ├── TrustVsScore.tsx          # Trust vs avg score; click → per-game score bars; needs boards prop
    │   ├── TrustVsTime.tsx           # Trust vs avg game duration; click → per-game duration bars
    │   └── TrustVsProximity.tsx      # Trust vs avg proximity to AI suggestion; null sessions listed separately; click → per-game proximity bars
    │
    ├── individual/
    │   ├── IndividualView.tsx       # Parent: participant selector, wires all sub-components
    │   ├── IndividualTimeline.tsx
    │   ├── GameBreakdown.tsx        # Stub — renders session avg; game-level bars need raw session passed in
    │   ├── ConditionExposure.tsx
    │   ├── ParticipantKpiCards.tsx
    │   └── SurveyResponseTable.tsx
    │
    ├── session/
    │   └── SessionView.tsx          # Participant + session dropdowns; metadata table + games table
    │                                #   (click row → expands per-hit coordinates + individual hit scores)
    │                                #   Navigated to automatically when a scatter point is clicked
    │
    └── raw/
        ├── SessionsTable.tsx        # Sortable/filterable sessions table; shows games_played vs actual array length (red if mismatch); CSV export; uses unfiltered sessions
        └── SurveyTable.tsx          # Sortable/filterable survey table; dynamic question columns; CSV export

public/
├── Perlin_Noise_Surfaces.ts/        # 100 board JSON files (PerlinNoiseBoard0.json … PerlinNoiseBoard99.json)
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
