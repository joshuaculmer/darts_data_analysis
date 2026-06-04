# Darts Research — Data Analysis Planning

## Data Schema

### `game_sessions`
| Field | Type | Notes |
|---|---|---|
| `execution_skill` | `number` | Primary performance metric |
| `games_played` | `number` | Volume of games in session |
| `ai_advice` | `AI_Type` (enum 0–6) | Experimental condition |
| `games` | `DartGameDTO[]` | Per-game breakdown — see type below |
| `user_uuid` | UUID | Participant identifier |
| `user_nickname` | `string \| null` | Display name |

### `post_session_survey_responses`
| Field | Type | Notes |
|---|---|---|
| `responses` | `Answer[]` | `{ questionId: string, value: string \| number \| boolean }` |
| `user_uuid` | UUID | |
| `user_nickname` | `string \| null` | |

**Current survey instrument** (four required questions; the old "performance perception"
Very Poor…Very Good item is **retired**):

| questionId | Group | Scale |
|---|---|---|
| `trust` | Trust | 5-point agreement Likert (Strongly Disagree…Strongly Agree) |
| `influence` | Trust | 5-point agreement Likert |
| `satisfied` | Performance | 5-point agreement Likert |
| `luck` | Luck | Very Unlucky…Very Lucky |

Scale label→score maps live in `src/utils/surveyScales.ts` (`ORDINAL_SCALES`); the
`SURVEY_DIMENSIONS` registry there maps each `questionId` → `{ label, group, scaleLabels }`.

### AI_Type Enum
```ts
enum AI_Type {
  NONE      = 0,  // control — no advice
  CORRECT   = 1,  // accurate advice
  RANDOM    = 2,  // random advice
  WRONG     = 3,  // incorrect advice
  BAD       = 4,  // bad advice
  GOOD_PLAUSIBLE = 5,  // starts good → turns plausible
  PLAUSIBLE_GOOD = 6,  // starts plausible → turns good
}
```
This is a **7-condition between/within-subjects design** studying how advice quality and trajectory affect darts performance.

### `DartGameDTO` — shape TBD
> Need type definition to unlock game-level visualizations (score distributions, round-by-round, accuracy over throws).

---

## Navigation Structure

The app uses `react-router-dom` (`BrowserRouter`). The dashboard is reorganized around three
variable-centric **research groups** (Trust / Performance / Luck), each rendering its dimensions'
by-condition/by-session/over-time charts, within-group pairwise scatters, and the global
cross-correlation heatmap (with that group's rows/columns highlighted). The old single Trust page
+ question-selector/graph-type toggle is retired.

| Route | Section | Purpose |
|---|---|---|
| `/sanity` | Sanity Checks | Verify the experiment ran as expected (KPIs, calendar, condition balance) |
| `/performance` | Game Performance | scorePerHit + proxOptimal by condition, satisfied dimension, pairwise, heatmap |
| `/trust` | Trust & Influence | trust + influence dimensions, proxAI by condition, pairwise, heatmap |
| `/luck` | Luck | luck dimension, dispersion + evGap (placeholder) by condition, pairwise, heatmap |
| `/individual/:uuid?` | Individual View | Per-participant story (timeline + survey overlays + breakdown) |
| `/session/:uuid/:sessionIndex` | Session View | Per-session/per-game drill-down (chronological) |
| `/raw` | Raw Data | Exportable sessions + survey tables (incl. extrapolated variables) |

### The unified variable set (9 session-level variables)
One `SessionVariableRow` per session drives the group pages, the global Spearman correlation
heatmap, and the Raw Data columns (`src/utils/variables.ts`):

| Key | Group | Source |
|---|---|---|
| `trust`, `influence` | Trust | survey (agreement 1–5) |
| `proxAI` | Trust | mean dist actual→AI suggestion (null in NONE) |
| `satisfied` | Performance | survey (agreement 1–5) |
| `scorePerHit` | Performance | `gameScore / hits.length`, session-avg (per-hit avoids dynamic-hit-count confound) |
| `proxOptimal` | Performance | mean dist actual→optimal aim |
| `luck` | Luck | survey (Very Unlucky 1…Very Lucky 5) |
| `dispersion` | Luck | mean hit→actual_aiming_coord spread |
| `evGap` | Luck | per-hit `scorePerHit − EV` (EV is placeholder 8 until the EV JSON lands) |

---

## Visualization Roadmap

### Section 1 — Sanity Checks ✓ (partial)
*Goal: confirm the study was administered correctly. These are verification charts, not research findings.*

- [x] KPI cards: total sessions, unique participants, avg games_played
- [x] Sessions by AI condition: bar chart of session count per AI_Type (balance check)
- [x] Session timeline: line chart of sessions over date (study cadence / enrollment pacing)
- [ ] Execution skill distribution: histogram of execution_skill across all participants (confirm preset values look reasonable)
- [ ] Execution skill by condition: counts/distribution to confirm admins assigned values as expected (not a research finding — just a balance check)
- [x] CSV file upload loader (papaparse, parses JSON columns automatically)

The three research groups share the same building blocks: per-dimension by-condition/by-session/
over-time charts (now dimension-agnostic — driven by `SURVEY_DIMENSIONS` + `scaleLabels` rather
than a hardcoded scale union), `VariableByCondition` mean±CI95 dot charts for continuous variables,
within-group `PairwiseScatter`s, and the shared global `CorrelationHeatmap` (Spearman, pairwise-
complete, click-to-scatter) with the active group's rows/columns highlighted.

### Section 2 — Game Performance (`/performance`)
*Goal: understand how game scores relate to AI condition.*

- [x] **scorePerHit by condition**: mean per-hit score ± CI95 per AI_Type (per-hit avoids the dynamic-hit-count confound)
- [x] **proxOptimal by condition**: mean distance from actual aim to the optimal aim, by condition
- [x] **satisfied dimension**: by-condition / by-session / over-time charts (agreement Likert)
- [x] **within-group pairwise scatters**: satisfied↔scorePerHit, satisfied↔proxOptimal, scorePerHit↔proxOptimal
- [x] **global heatmap** with Performance rows/columns highlighted
- [ ] **Ordering effect**: GOOD_PLAUSIBLE vs PLAUSIBLE_GOOD score delta (does trajectory matter?)

### Section 3 — Trust & Influence (`/trust`)
*Goal: how much participants trusted/were influenced by the AI, and whether that translated into behavior.*

- [x] **trust + influence dimensions**: by-condition / by-session / over-time charts (agreement Likert)
- [x] **proxAI by condition**: mean distance from actual aim to the AI suggestion (null in NONE)
- [x] **within-group pairwise scatters**: trust↔influence, trust↔proxAI, influence↔proxAI
- [x] **global heatmap** with Trust rows/columns highlighted
- [ ] **Trust trajectory**: GOOD_PLAUSIBLE vs PLAUSIBLE_GOOD trust arc — did trust recover when advice improved?

### Section 4 — Luck (`/luck`)
*Goal: how much participants attribute outcomes to luck, and how that relates to spread / EV gap.*

- [x] **luck dimension**: by-condition / by-session / over-time charts (Very Unlucky…Very Lucky)
- [x] **dispersion by condition**: mean hit spread around the actual aim, by condition
- [x] **evGap by condition**: per-hit score − EV (EV is a placeholder 8/hit until the EV JSON lands — labeled in UI)
- [x] **within-group pairwise scatters**: luck↔dispersion, luck↔evGap, dispersion↔evGap
- [x] **global heatmap** with Luck rows/columns highlighted

### Individual View (`/individual/:uuid?`)
*Goal: tell the full story of a single participant's experience. Analyst selects a participant from a dropdown.*

- [x] **Participant selector**: dropdown populated from unique user_uuid / user_nickname pairs
- [x] **Wholistic timeline**: per-hit score over sessions with condition-colored dots; toggleable per-dimension survey overlays (trust/influence/satisfied/luck, only those with data), each an Okabe-Ito line on a shared right axis (retired "performance" series dropped)
- [x] **Condition exposure summary**: chronological dot-track showing which condition each session used
- [x] **Per-game breakdown**: session tab picker + per-session score bar
- [x] **Survey responses**: per-session table of all survey answers, with condition badge per row
- [x] **Narrative summary card**: KPI cards — sessions played, avg score, conditions seen

### Session View (`/session/:uuid/:sessionIndex`)
- [x] Participant + session pills in chronological order; session metadata table
- [x] Per-game table with expandable hit rows (coordinates + per-hit scores), board ID/seed, and per-game scorePerHit / dispersion / EV-gap (placeholder EV)
- [x] Reached automatically when a scatter point or calendar day is clicked (route-based navigation)

### Section 5 — Raw Data & Export
- [x] Filterable/sortable sessions table with CSV export — shows participant, UUID, condition, exec skill, games_played vs games array length (red if mismatch), avg score/game, date, plus extrapolated session-level variables (avg hits/game, total score, scorePerHit, proxAI, proxOptimal, dispersion μ/σ, EV gap [placeholder], and joined survey trust/influence/satisfied/luck)
- [x] Survey responses table with CSV export — dynamic question columns, filterable by participant/UUID, sortable by participant/date

---

## Tech Stack (to install)
- **Recharts** — primary charting library (React-native, TS-friendly)
- **TanStack Table v8** — sortable/filterable tables
- **Tailwind CSS** — styling (optional, could use CSS modules instead)
- Data source: static JSON export from Supabase DB dump

---

## Type Files
- `src/types/dart.ts` — `Coord`, `DartGameDTO`, `AI_Type`, `Game_SessionDTO`
- `src/types/survey.ts` — `Question`, `QuestionType`, `Answer`, `PostSessionSurveyResponseDTO`
- `src/types/db.ts` — `GameSessionRow`, `SurveyResponseRow` (raw CSV shapes; JSON columns are strings pre-parse)

## Resolved
- **Survey CSV wired:** yes — both CSVs (or the Supabase Fetch Data path) load before the dashboard; survey is joined per session via `joinSessionsWithSurvey`.
- **Trust questionId:** the instrument is fixed to `trust` / `influence` / `satisfied` / `luck` (see survey schema above); still read dynamically through `SURVEY_DIMENSIONS`.
- **`board_id`:** indexes a reward surface in a unified ID space (0–99 Perlin, 100–199 Gaussian); each is a 512×512 `number[][]`. Score = sum of `surface[floor(hit.x)][floor(hit.y)]`.
- **`start`/`end` on `DartGameDTO`:** timestamps, **not** scores. Used only for game duration.
- **`Coord`:** board-pixel space — `Math.floor` before indexing the 512×512 surface.

## Open Questions
1. Is this within-subjects, between-subjects, or mixed? (Can the same user appear across multiple AI conditions?)
2. Is `execution_skill` a computed aggregate or raw preset value? How is it derived?
3. **EV dataset:** the per-board × aim × skill expected-value JSON that replaces the flat placeholder (8/hit) in `aimingEV.ts` — when does it land, and what is its shape?
