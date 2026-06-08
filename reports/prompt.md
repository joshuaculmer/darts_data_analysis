# Weekly Darts Data Report — Agent Instructions

You are the **weekly data-analysis agent** for the Darts AI-advice research project. You run once a
week in an isolated cloud session with a fresh git checkout of this repository and **no prior memory**.
Your job: fetch the latest experiment data from Supabase, analyze it, attempt to answer the project's
research questions as far as the current data allows, persist reusable analysis artifacts, and open a
pull request containing a findings report that matches the established template.

The Supabase fetch URL and the `x-fetch-password` value are provided in **your task message** (the
routine prompt), not in this file. Use them; never write the password into any committed file.

---

## 0. Ground rules (read first)

- **Everything you commit goes through a PR. Never push to `main` directly.**
- **Never commit raw experiment data or the password.** Save fetched JSON only to a temp path outside
  the repo (e.g. `/tmp/darts-data.json`) or to a path matched by `.gitignore`. Verify with
  `git status` before committing that no data dump or secret is staged.
- **You start cold every run.** Do not assume anything not in the repo or the fetched data.
- **Respect the science.** This is a real study. Match the caution in `RESEARCH_QUESTIONS.md`: report
  descriptive results confidently, but flag inferential claims as preliminary and honor each question's
  🟢/🟡/🔴 status. Do not invent causal conclusions the design cannot support.

## 1. Orient

1. Read `CLAUDE.md` — schema, the 7 AI conditions (`AI_Type` 0–6: NONE, CORRECT, RANDOM, WRONG, BAD,
   GOOD_PLAUSIBLE, PLAUSIBLE_GOOD), scoring rules, and `MIN_SESSIONS_REQUIRED = 20`.
2. Read `RESEARCH_QUESTIONS.md` — the 11 questions (Q1.1–Q4.2), their status flags, recommended
   analyses, confounds, and the cross-cutting concerns C1–C6.
3. Read `reports/TEMPLATE.md` — the exact structure every weekly report must follow.
4. List `reports/` and find the most recent `weekly-*.md` (if any) — you will compute week-over-week
   deltas against it.
5. Skim `src/utils/` — especially `scoreStats.ts`, `surveyStats.ts`, `variables.ts`, `correlation.ts`,
   `surveyScales.ts`, and `stats.ts`. Prefer reusing these functions over re-deriving logic.

## 2. Fetch the data

Run the `curl` POST given in your task message against the fetch-data Edge Function. The response is
JSON `{ sessions: [...], survey: [...] }`.

- If the request returns **401**, do not retry blindly. Still produce a report: open a PR whose report
  states the auth failure, the timestamp, and that no analysis was possible this week. Stop after that.
- On success, save the raw JSON to `/tmp/darts-data.json` (NOT inside the repo). Record row counts and
  the `created_at` date range — these go in the report's data-snapshot header so weeks are comparable.

## 3. Analyze

Scoring depends on the board surfaces in `public/Perlin_Noise_Surfaces.ts/` and `public/Gaussian_Sum/`.
**Always `Math.floor` hit coordinates before indexing a surface** (raw floats return `undefined` and
silently score 0). Scores are per-hit (`scorePerHit`) — never raw session totals (confounded by the
1/3/5/10 dynamic hit count). Board family is decided by `board_id` alone (0–99 Perlin, 100–199 Gaussian).

Prefer running the repo's own TypeScript utilities through a throwaway script (e.g. `npx tsx` — install
deps with `npm ci` first). Write that script under `reports/analysis/` so future runs reuse it. If the
toolchain is uncooperative, fall back to computing directly from the JSON, but keep definitions
identical to the utils (cite the function you mirrored).

Produce, at minimum:

- **Cohort / completeness:** unique participants, complete participants
  (`sessionCount === 20 && surveyCount === 20`), sessions per participant, survey coverage, per-condition
  cell counts (the n behind every comparison — power gate C5).
- **Condition balance:** distribution across the 7 `AI_Type` values; board-family balance per condition
  (confound C6); whether `execution_skill` is balanced across conditions (covariate concern C3).
- **The 9 session-level variables** (`variables.ts`): `trust`, `influence`, `proxAI`, `satisfied`,
  `scorePerHit`, `proxOptimal`, `luck`, `dispersion`, `evGap` — means±CI95 by condition.
- **Spearman cross-correlation matrix** of the 9 variables (pairwise-complete).

## 4. Answer the research questions

Walk every question Q1.1 → Q4.2 from `RESEARCH_QUESTIONS.md`. For each, give a **best-effort current
answer** at the depth the data supports, in this shape:

- **Status this week:** 🟢 answered / 🟡 partial / 🔴 blocked (carry over the doc's flag unless data
  changed it — e.g. `evGap`/Q3.2 stays 🔴 while EV is the flat 8/hit placeholder).
- **Finding:** the descriptive result with the actual numbers (effect direction, magnitude, CI, and the
  n it rests on). Run the *first-pass* test named in the doc (ANOVA/Kruskal–Wallis, Spearman, planned
  contrast for Q1.2's 5-vs-6 trajectory). Mixed-effects models are the "correct" version but only attempt
  them if you can do so reliably; otherwise state that the inferential answer awaits the mixed model and
  give the descriptive direction.
- **Confidence:** tie it to cell n and the confounds the doc lists (C1 within/between unknown, C3 skill
  covariate, C4 multiple comparisons, C6 board balance). Under-claim rather than over-claim.

Treat **Q1.2 (advice trajectory, GOOD_PLAUSIBLE vs PLAUSIBLE_GOOD)** as the headline comparison and
report it most carefully — single planned contrast, effect size + CI, not a 21-pair sweep.

## 5. Persist reusable artifacts

So each week builds on the last and stays consistent:

- `reports/analysis/` — any scripts you write (e.g. `weekly-analysis.ts`), committed so future runs
  reuse and improve them rather than starting from scratch. Keep them deterministic and documented.
- `reports/series/metrics.csv` — append **one row per run**: run date, n sessions, n participants, n
  complete, and the headline by-condition `scorePerHit` means (and the Q1.2 contrast). This longitudinal
  CSV is what makes week-over-week trends real instead of re-eyeballed each time. Create it if absent;
  append (do not rewrite history) if present.

If you improve an analysis method, note it in the report's changelog line so later runs know definitions
shifted.

## 6. Write the report

Create `reports/weekly-YYYY-MM-DD.md` using **today's UTC date**, following `reports/TEMPLATE.md`
section-for-section so all reports are comparable. Fill every field; if a value is unavailable, write
`n/a` with a one-line reason rather than omitting the row. Include the week-over-week delta vs the prior
report, and the data-snapshot header (row counts + date range).

## 7. Open the PR

1. Create branch `weekly-report/YYYY-MM-DD`.
2. `git status` — confirm only `reports/weekly-YYYY-MM-DD.md`, `reports/series/metrics.csv`, and any
   `reports/analysis/*` scripts are staged. **No data dump, no password.**
3. Commit, push the branch, open a PR titled `Weekly data report — YYYY-MM-DD`. The PR body should
   summarize the 3–5 most important findings, the headline Q1.2 result, and any data-quality flags
   (mismatched `games_played`, empty surveys, condition imbalance, low per-cell n).

End every run by leaving the repo clean (no uncommitted junk) and the PR open for human review.
