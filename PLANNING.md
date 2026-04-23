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

### AI_Type Enum
```ts
enum AI_Type {
  NONE      = 0,  // control — no advice
  CORRECT   = 1,  // accurate advice
  RANDOM    = 2,  // random advice
  WRONG     = 3,  // incorrect advice
  BAD       = 4,  // bad advice
  GOOD_BAD  = 5,  // starts good → turns bad
  BAD_GOOD  = 6,  // starts bad → turns good
}
```
This is a **7-condition between/within-subjects design** studying how advice quality and trajectory affect darts performance.

### `DartGameDTO` — shape TBD
> Need type definition to unlock game-level visualizations (score distributions, round-by-round, accuracy over throws).

---

## Navigation Structure

The app will have a top navbar with five sections:

1. **Sanity Checks** — verify the experiment ran as expected
2. **Game Performance** — score outcomes by condition and trust
3. **Trust & Influence** — how trust develops and affects performance
4. **Individual View** — per-participant story
5. **Raw Data** — exportable tables

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

### Section 2 — Game Performance
*Goal: understand how game scores relate to AI condition and to trust.*

- [x] **Box plots**: score distribution per AI_Type condition
- [x] **Bar chart**: mean score per condition with 95% CI error bars
- [x] **Scatter**: games_played vs score colored by AI_Type
- [x] **Before/after paired chart**: slope chart per user across conditions (hidden if <2 conditions)
- [x] **Score vs execution_skill scatter**: how does preset skill level relate to actual in-game score?
- [ ] **Score by trust level**: group participants by survey-reported trust quartile, compare scores — requires survey CSV
- [x] **Score vs trust scatter**: per-session score vs trust rating — shown in both this section and Trust & Influence; requires trust question to be selected
- [ ] **Ordering effect**: GOOD_BAD vs BAD_GOOD score delta (does trajectory matter?)

### Section 3 — Trust & Influence
*Goal: understand how much participants trusted the AI, how that trust was shaped by condition, and whether trust translated into better scores.*

- [x] **Trust question selector**: analyst picks which survey question ID represents trust — drives all charts below
- [x] **Trust by AI condition**: mean trust rating per AI_Type (bar chart with 95% CI error bars)
- [x] **Trust over time**: scatter of trust rating by session date, colored by AI condition
- [ ] **Trust trajectory**: GOOD_BAD vs BAD_GOOD trust arc — did trust recover when advice improved?
- [x] **Trust → score**: scatter of trust rating vs game score, colored by AI_Type — key research question
- [ ] **Survey breakdown**: stacked Likert bars per question (SD → SA) for all trust-related questions
- [ ] **Per-condition survey heatmap**: participant × question, color = response value, faceted by AI_Type

### Section 4 — Individual View
*Goal: tell the full story of a single participant's experience. Analyst selects a participant from a dropdown.*

- [x] **Participant selector**: dropdown populated from unique user_uuid / user_nickname pairs
- [x] **Session timeline**: line chart of score over sessions, with condition-colored dots and optional trust overlay
- [x] **Trust over sessions**: trust rating overlaid on the session timeline (right axis, dashed line)
- [x] **Condition exposure summary**: chronological dot-track showing which condition each session used
- [x] **Per-game breakdown**: session tab picker + per-session score bar (avg score; full game-level bars available when raw session object is passed)
- [x] **Survey responses**: per-session table of all survey answers, with condition badge per row
- [x] **Narrative summary card**: KPI cards — sessions played, avg score, avg trust, conditions seen

### Section 5 — Raw Data & Export
- [ ] Filterable/sortable sessions table with CSV export
- [ ] Raw survey responses table, filterable by participant and condition

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

## Open Questions
1. **Survey CSV loaded?** Sections 2 and 3 both have trust-dependent charts — is the post-session survey CSV already wired into the app, or does it need to be added?
2. What are the survey `questionId` strings that correspond to trust? (Treat dynamically if they change over time, but need at least the trust-relevant IDs to label charts correctly.)
3. Is this within-subjects, between-subjects, or mixed? (Can the same user appear across multiple AI conditions?)
4. Is `execution_skill` a computed aggregate or raw score? How is it derived? (Important for the score vs execution_skill scatter in Section 2.)
5. What does `board_id` represent — a physical board, a target zone, or a game type?
6. Are `start`/`end` in `DartGameDTO` scores (e.g. 501 → 0) or timestamps?
7. Is `Coord` in pixel space, normalized [0,1], or some board-relative unit?
