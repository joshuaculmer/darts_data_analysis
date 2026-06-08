<!--
  TEMPLATE for weekly data reports. Copy to reports/weekly-YYYY-MM-DD.md and fill EVERY field.
  Keep the section order identical across all weeks so reports are directly comparable.
  Replace bracketed [...] placeholders. Use `n/a (reason)` when a value cannot be computed — never
  delete a row. Numbers shown below are ILLUSTRATIVE EXAMPLES, not real data.
-->

# Weekly Darts Data Report — [YYYY-MM-DD]

**Run (UTC):** [2026-06-12T14:00Z] · **Agent model:** [claude-sonnet-4-6] ·
**Method changelog:** [none / "switched scorePerHit to repo util computeSessionScorePerHit"]

## Data snapshot

| Field | This week | Last week | Δ |
|---|---:|---:|---:|
| Sessions (rows) | [1,240] | [1,180] | [+60] |
| Unique participants | [62] | [60] | [+2] |
| Complete participants (20+20) | [18] | [17] | [+1] |
| Survey responses | [1,205] | [1,150] | [+55] |
| `created_at` range | [2026-04-01 → 2026-06-12] | [2026-04-01 → 2026-06-05] | — |
| Data fetch | [OK] | [OK] | — |

> Completeness gate (C5): per-condition complete-participant n drives how much to trust every
> comparison below. Spell out the smallest cell.

## Executive summary

- [3–5 bullets: the most important findings this week, in plain language.]
- [Headline trajectory result Q1.2 (GOOD_PLAUSIBLE vs PLAUSIBLE_GOOD) stated explicitly.]
- [Any data-quality red flags.]

## Cohort & condition balance

**Sessions per AI condition** (smallest cell gates power):

| AI_Type | Condition | Sessions | Complete-ppt n | Board family balance | Skill balance |
|---|---|---:|---:|---|---|
| 0 | NONE | [—] | [—] | [Perlin/Gaussian split] | [ok/skew] |
| 1 | CORRECT | [—] | [—] | [—] | [—] |
| 2 | RANDOM | [—] | [—] | [—] | [—] |
| 3 | WRONG | [—] | [—] | [—] | [—] |
| 4 | BAD | [—] | [—] | [—] | [—] |
| 5 | GOOD_PLAUSIBLE | [—] | [—] | [—] | [—] |
| 6 | PLAUSIBLE_GOOD | [—] | [—] | [—] | [—] |

## Variable summary (means ± CI95 by condition)

One block or table per variable. Variables: `scorePerHit`, `proxOptimal`, `proxAI`, `trust`,
`influence`, `satisfied`, `luck`, `dispersion`, `evGap` (evGap = placeholder, EV is flat 8/hit).

| Variable | NONE | CORRECT | RANDOM | WRONG | BAD | GOOD_PLAUS | PLAUS_GOOD |
|---|---:|---:|---:|---:|---:|---:|---:|
| scorePerHit | [—] | [—] | [—] | [—] | [—] | [—] | [—] |
| proxOptimal | [—] | … | | | | | |
| … | | | | | | | |

## Cross-correlation (Spearman, pairwise-complete)

[Compact 9×9 matrix or the top correlations with |r| and n. Note evGap rows are placeholder-contaminated.]

## Research questions — best-effort answers

For each: **Status** (🟢/🟡/🔴) · **Finding** (numbers, direction, effect size + CI, n) · **Confidence**.

### Group 1 — Performance
- **Q1.1 — AI condition → scorePerHit.** Status [🟢]. Finding: [ANOVA/KW result; by-condition means]. Confidence: [—].
- **Q1.2 — Trajectory 5 vs 6 (HEADLINE).** Status [🟢]. Finding: [planned contrast, SMD + CI, n per arm]. Confidence: [—].
- **Q1.3 — AI → proxOptimal.** Status [🟢]. Finding: [—]. Confidence: [—].
- **Q1.4 — satisfied calibrated to scorePerHit.** Status [🟢]. Finding: [Spearman r, n]. Confidence: [—].

### Group 2 — Trust & influence
- **Q2.1 — condition → trust/influence.** Status [🟢]. Finding: [—]. Confidence: [—].
- **Q2.2 — trust → proxAI (excl. NONE).** Status [🟢]. Finding: [—]. Confidence: [—].
- **Q2.3 — trust trajectory 5 vs 6.** Status [🟡]. Finding: [end-of-session trust contrast]. Confidence: [—].

### Group 3 — Luck
- **Q3.1 — luck vs dispersion/scorePerHit.** Status [🟢]. Finding: [—]. Confidence: [—].
- **Q3.2 — evGap ↔ luck.** Status [🔴 blocked: flat 8/hit EV placeholder]. Finding: [n/a]. Confidence: [—].

### Group 4 — Mediation & structure
- **Q4.1 — trust mediates condition → performance.** Status [🟡]. Finding: [pairwise pieces; note temporal/design caveat]. Confidence: [—].
- **Q4.2 — overall cross-variable structure.** Status [🟢 exploratory]. Finding: [factor/heatmap notes]. Confidence: [—].

## Cross-cutting concerns status

- **C1 within/between-subjects:** [resolved? / still unknown — affects every model].
- **C3 execution_skill provenance:** [raw preset vs derived].
- **C4 multiple comparisons:** [corrections applied].
- **C5 power / per-cell n:** [smallest cell n].
- **C6 board family balance:** [balanced? / covariate needed].

## Data-quality flags

- [`games_played` vs actual games-array length mismatches, empty surveys, duplicate user rows, etc.]

## Changes & next steps

- [Method changes this run; what would unblock 🟡/🔴 questions; suggested follow-ups.]
