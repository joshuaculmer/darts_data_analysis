# Darts Research — Data Analysis Tool

## Project Purpose
A Vite/React/TypeScript single-page app for analyzing a 7-condition darts experiment studying how AI advice quality and trajectory affect player performance and trust.

## Data Sources
The app requires **two user-provided CSV files**, both exported from Supabase. Neither is bundled — the user uploads them at runtime via file inputs.

| CSV | State | Description |
|---|---|---|
| `game_sessions.csv` | Wired in (`App.tsx`) | One row per session; includes `execution_skill`, `games_played`, `ai_advice` (AI_Type 0–6), and a JSON-serialized `games` column |
| `post_session_survey.csv` | **Not yet wired in** | One row per survey submission; includes a JSON-serialized `responses` column (array of `{ questionId, value }`) |

Both loaders already exist in `src/loaders/loadData.ts` (`loadGameSessions`, `loadSurveyResponses`). The survey file input and state just need to be added to `App.tsx`.

The app must ask for both CSVs before rendering the dashboard. Survey-dependent charts should render only after the survey CSV is also loaded.

## Key Experimental Design Facts
- `execution_skill` and `ai_advice` (AI condition) are **preset by admins** before each session — they are not outcomes. Do not frame charts of these as findings.
- The 7 AI conditions (`AI_Type` enum 0–6): NONE, CORRECT, RANDOM, WRONG, BAD, GOOD_BAD, BAD_GOOD.
- GOOD_BAD and BAD_GOOD are ordering conditions — same advice quality, different trajectory. Comparing them is a key research question.
- Core research questions: Does AI condition affect game score? Does trust mediate performance? Does trust improve score?

## Navigation Structure
The app uses a top navbar with five sections. See `PLANNING.md` for the full chart roadmap per section.

| Section | Purpose |
|---|---|
| Sanity Checks | Verify study administration — balance/QA, not research findings |
| Game Performance | Score outcomes by AI condition, score vs trust, score vs execution_skill |
| Trust & Influence | Trust by condition, trust over time, trust → score relationship |
| Individual View | Per-participant story; analyst selects participant from dropdown |
| Raw Data | Filterable/exportable tables |

## Type Files
- `src/types/dart.ts` — `AI_Type` enum, `Coord`, `DartGameDTO`, `Game_SessionDTO`
- `src/types/survey.ts` — `Question`, `Answer`, `PostSessionSurveyResponseDTO`
- `src/types/db.ts` — `GameSessionRow`, `SurveyResponseRow` (raw CSV row shapes; JSON columns are strings pre-parse)
- `src/loaders/loadData.ts` — `ParsedGameSession`, `ParsedSurveyResponse`, `loadGameSessions()`, `loadSurveyResponses()`

## Tech Stack
- **Vite + React + TypeScript**
- **Recharts** — primary charting library
- **PapaParse** — CSV parsing (already installed; handles JSON column strings)
- **TanStack Table v8** — sortable/filterable tables (planned)
- **Tailwind CSS** — styling (planned; currently using CSS modules/App.css)

## Conventions
- Chart components live in `src/components/<section>/`. Current components are under `phase1/` and `phase2/` — these will be reorganized to match the new navbar section names.
- Stats/aggregation logic lives in `src/utils/stats.ts`, not inside components.
- `safeParseJSON<T>(value, fallback)` in `loadData.ts` is the standard way to parse JSON columns from CSV rows.
- Survey `questionId` strings are treated dynamically — do not hardcode them. Trust-related questions must be identified by ID at runtime or via a config the analyst can update.
