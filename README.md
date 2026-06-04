# Darts Research — Data Analysis Tool

A Vite/React/TypeScript single-page app for analyzing a **7-condition darts experiment** that
studies how the **quality** and **trajectory** of AI advice affect player performance and trust.

The app ingests two CSV exports (game sessions + post-session surveys), reconstructs each throw's
score from the underlying reward surfaces, and presents a research dashboard organized around three
variable groups — **Trust**, **Performance**, and **Luck** — plus per-participant and per-session
drill-downs.

> Contributor docs live in [`CLAUDE.md`](./CLAUDE.md) (architecture, file tree, conventions),
> [`PLANNING.md`](./PLANNING.md) (data schema + chart roadmap), and [`PALETTE.md`](./PALETTE.md)
> (visual design tokens). This README is the high-level orientation; those files are the source of
> truth for implementation detail.

---

## The Experiment

Participants throw darts at a board whose surface is a continuous **reward landscape** (Perlin noise
or a Gaussian sum). Before each session, an admin presets the participant's `execution_skill` and the
**AI advice condition** they will receive. After each session the participant fills out a short survey.

### The 7 AI conditions (`AI_Type` 0–6)

| Value | Condition | Meaning |
|---|---|---|
| 0 | `NONE` | Control — no advice |
| 1 | `CORRECT` | Accurate advice |
| 2 | `RANDOM` | Random advice |
| 3 | `WRONG` | Incorrect advice |
| 4 | `BAD` | Deliberately bad advice |
| 5 | `GOOD_PLAUSIBLE` | Starts good → degrades to merely plausible |
| 6 | `PLAUSIBLE_GOOD` | Starts plausible → improves to good |

Conditions 5 and 6 carry the **same overall advice quality but opposite trajectories** — comparing
them isolates whether the *order* in which advice quality changes matters, independent of its average.

`execution_skill` and `ai_advice` are **preset by admins**, not outcomes. Charts of those fields are
balance/sanity checks, never findings.

---

## Research Questions

The dashboard is built to answer:

1. **Does AI condition affect game score?** — `scorePerHit` by condition (Performance group).
2. **Does advice trajectory matter?** — `GOOD_PLAUSIBLE` vs `PLAUSIBLE_GOOD` on score and on the
   trust arc (does trust recover when advice improves, and vice versa?).
3. **Does the AI change behavior?** — `proxAI` (how close throws land to the AI suggestion) and
   `proxOptimal` (how close to the true optimal aim) by condition.
4. **Does trust mediate performance?** — cross-correlations between the trust, performance, and luck
   variables (Spearman heatmap + pairwise scatters).
5. **How do participants attribute outcomes?** — self-reported `luck` vs measured hit `dispersion`
   and expected-value gap.

---

## Data Model

### Inputs (provided at runtime, never bundled)

| Source | What it is |
|---|---|
| `game_sessions.csv` | One row per session: `execution_skill`, `games_played`, `ai_advice`, and a JSON `games` column (per-game hits, board ID, timestamps) |
| `post_session_survey.csv` | One row per survey: a JSON `responses` array of `{ questionId, value }` |
| Board surfaces | Auto-fetched 512×512 reward grids referenced by each session's `board_id` |

Both CSVs persist in `localStorage`, so the dashboard survives a refresh. A **Fetch Data** button can
alternatively pull both tables directly from Supabase via a password-protected Edge Function (see
`CLAUDE.md` → *Supabase Direct Fetch*).

### Survey instrument (4 questions)

| `questionId` | Group | Scale |
|---|---|---|
| `trust` | Trust | 5-point agreement Likert |
| `influence` | Trust | 5-point agreement Likert |
| `satisfied` | Performance | 5-point agreement Likert |
| `luck` | Luck | Very Unlucky … Very Lucky |

Label→score maps and the dimension registry live in `src/utils/surveyScales.ts`.

### Score computation

Scores are **computed from the board surface**, not read from any CSV field:

```
gameScore    = Σ surface[floor(hit.x)][floor(hit.y)]  for each hit
sessionScore = { gameScores[], sum, avg }  across the session's games
```

Hit coordinates are floats — always `Math.floor` before indexing the 512×512 surface. The canonical
score metric is **per-hit** (`scorePerHit`), because the raw session total is confounded by a dynamic
hit count (1/3/5/10 per game). `start`/`end` on a game are **timestamps**, not scores.

### The unified 9-variable set

One `SessionVariableRow` per session drives the group pages, the correlation heatmap, and the Raw Data
export (`src/utils/variables.ts`):

| Variable | Group | Source |
|---|---|---|
| `trust`, `influence` | Trust | survey (1–5) |
| `proxAI` | Trust | mean distance throw → AI suggestion (null in `NONE`) |
| `satisfied` | Performance | survey (1–5) |
| `scorePerHit` | Performance | `gameScore / hits`, session-averaged |
| `proxOptimal` | Performance | mean distance throw → optimal aim |
| `luck` | Luck | survey (1–5) |
| `dispersion` | Luck | mean hit spread around the actual aim |
| `evGap` | Luck | per-hit `scorePerHit − EV` (EV is a **placeholder 8/hit** until the EV dataset lands) |

---

## Dashboard Sections

| Route | Section | What it shows |
|---|---|---|
| `/sanity` | Sanity Checks | KPI cards, participants-per-day calendar, condition-balance distribution |
| `/performance` | Game Performance | `scorePerHit` + `proxOptimal` by condition, `satisfied` dimension, within-group scatters, global heatmap |
| `/trust` | Trust & Influence | `trust` + `influence` dimensions, `proxAI` by condition, within-group scatters, global heatmap |
| `/luck` | Luck | `luck` dimension, `dispersion` + `evGap` by condition, within-group scatters, global heatmap |
| `/individual/:uuid?` | Individual View | Per-participant timeline with toggleable survey overlays + game breakdown |
| `/session/:uuid/:sessionIndex` | Session View | Per-session/per-game drill-down with expandable hit rows |
| `/raw` | Raw Data | Sortable/filterable sessions + survey tables with CSV export |

Each research group shares the same building blocks: dimension-agnostic by-condition / by-session /
over-time charts, `VariableByCondition` mean±CI95 dot charts, within-group `PairwiseScatter`s, and the
shared Spearman `CorrelationHeatmap` (pairwise-complete, click-to-scatter) with the active group's
rows/columns highlighted. All sections except Raw Data respect the **Complete Participants** toggle
(`MIN_SESSIONS_REQUIRED = 20`).

---

## Getting Started

```bash
npm install
npm run dev        # start the dev server
npm run build      # type-check + production build
npm run preview    # serve the production build locally
npm test           # run the vitest suite once
npm run test:watch # watch mode
npm run lint       # eslint
```

Open the app, upload both CSVs (or use **Fetch Data**), let the board surfaces load, and the dashboard
appears. The **Clear Data** button (top-right) wipes the stored CSVs and resets to the upload screen.

### Tech stack

- **Vite + React 19 + TypeScript**
- **Recharts** — charting
- **PapaParse** — CSV parsing (handles the JSON-string columns)
- **react-router-dom** — `BrowserRouter` routing (deploys under a GitHub Pages subpath)
- **Vitest** — tests, colocated as `foo.ts` / `foo.test.ts`

Development follows **TDD** (red → green): write a failing test first, implement until it passes. Stats
and aggregation logic lives in `src/utils/`, never inside components.

---

## Project Layout (high level)

```
src/
├── App.tsx              # routing, CSV upload, board loading
├── types/               # dart, survey, db (raw CSV) types
├── loaders/             # CSV + board-surface loaders
├── data/                # optimal-aiming lookup tables (Perlin / Gaussian)
├── utils/               # stats, scoreStats, surveyStats, variables, correlation, …
└── components/          # one folder per section: sanity/ performance/ trust/ luck/
                         #   individual/ session/ raw/ correlation/
public/
├── Perlin_Noise_Surfaces.ts/   # board_id 0–99
└── Gaussian_Sum/               # board_id 100–199 (file index = id − 100)
```

See [`CLAUDE.md`](./CLAUDE.md) for the full annotated file tree and module responsibilities.

---

## Known Placeholders & Open Questions

- **Expected-value (EV) dataset** — `aimingEV.ts` returns a flat `8/hit` placeholder until the
  per-board × aim × skill EV JSON lands. The `evGap` variable and any EV-derived chart are labeled as
  placeholders in the UI.
- **Design type** — whether the same participant spans multiple AI conditions (within- vs
  between-subjects) is not yet pinned down.
- **`execution_skill` derivation** — whether it is a raw preset or a computed aggregate.
