# Darts Research — Research Questions

A living catalog of the questions this experiment can address, how close we are to answering each,
the statistical approach best suited to it, and the confounds to watch for.

> **Status legend**
> - 🟢 **Answerable now** — the variables exist in the dashboard and the analysis is well-posed.
> - 🟡 **Partial** — we can describe/visualize it, but a clean inferential answer is blocked by a
>   missing piece (EV dataset, unknown design structure, or sample size).
> - 🔴 **Blocked** — a prerequisite (data or design fact) is missing; listed so we don't forget it.
>
> **Design facts that gate everything** (see *Cross-cutting concerns* below):
> 1. Is the same participant exposed to multiple AI conditions? (within- vs between-subjects)
> 2. Is `execution_skill` a raw preset or a derived aggregate?
> 3. The expected-value (EV) dataset is still a flat `8/hit` placeholder.

---

## How to read each entry

Each question lists:
- **Question** — the hypothesis in plain language.
- **Variables** — the dashboard columns (`src/utils/variables.ts`) that operationalize it.
- **Status** — 🟢 / 🟡 / 🔴 and why.
- **Recommended analysis** — the test/model that fits the data shape.
- **Confounds & notes** — what could make a naive result misleading.

A recurring theme: most outcomes are **repeated measures nested within participant** (many sessions
per `user_uuid`). That means independence is violated for any test that treats sessions as i.i.d., so
the "correct" version of almost every test below is a **mixed-effects model with a random intercept
for `user_uuid`**. The simpler tests (ANOVA, plain correlation) are listed as the *visual / first-pass*
analysis the dashboard already supports.

---

## Group 1 — Performance: does the AI change scores?

### Q1.1 — Does AI condition affect game score? 🟢
- **Variables:** `scorePerHit` (outcome) × `ai_advice` (7-level factor).
- **Recommended analysis:**
  - *First pass:* one-way ANOVA / Kruskal–Wallis of `scorePerHit` across the 7 conditions, with the
    by-condition mean±CI95 dot chart already on `/performance`.
  - *Correct version:* linear mixed model `scorePerHit ~ ai_advice + execution_skill + (1 | user_uuid)`.
    Including `execution_skill` as a covariate is essential because it is preset and directly drives score.
  - *Post-hoc:* Dunnett's test contrasting each condition against `NONE` (the natural control), which is
    more powerful and more interpretable than all-pairs Tukey.
- **Confounds & notes:** `scorePerHit` is the canonical metric precisely because raw session total is
  confounded by the dynamic hit count (1/3/5/10). Do **not** revert to totals. Score magnitude also
  depends on which board family (Perlin vs Gaussian) and which board seed — include `board_id` family as
  a covariate or confirm it is balanced across conditions.

### Q1.2 — Does advice trajectory matter (the ordering question)? 🟢 — *primary hypothesis*
- **Variables:** `scorePerHit` for `GOOD_PLAUSIBLE` (5) vs `PLAUSIBLE_GOOD` (6).
- **Recommended analysis:** a single **planned contrast** (condition 5 vs 6) inside the Q1.1 model —
  this is the cleanest, highest-powered test because the two conditions hold average advice quality
  constant and vary only the order. Report the effect size (standardized mean difference) and CI, not
  just a p-value.
- **Confounds & notes:** This is the study's headline comparison, so it deserves a *pre-registered,
  single* contrast rather than being buried in a 21-pair post-hoc sweep (which inflates the multiple-
  comparison penalty). If the design is within-subjects, use the paired form.

### Q1.3 — Does the AI move throws toward the optimal aim? 🟢
- **Variables:** `proxOptimal` (mean distance throw → optimal aim) × `ai_advice`.
- **Recommended analysis:** same mixed model as Q1.1 with `proxOptimal` as outcome. Expect `CORRECT`
  to reduce distance vs `NONE`; `WRONG`/`BAD` to increase it. This is the *behavioral* complement to the
  *outcome* measure in Q1.1 — it shows whether advice changed aiming even when it didn't change score.
- **Confounds & notes:** `proxOptimal` depends on the optimal-aim lookup (`aimingLookup.ts`), which is
  keyed by `execution_skill`; verify skill is matched across the conditions being compared.

### Q1.4 — Is "satisfaction" calibrated to actual performance? 🟢
- **Variables:** `satisfied` (survey 1–5) × `scorePerHit`.
- **Recommended analysis:** Spearman correlation (already on the heatmap + pairwise scatter), then a
  mixed model `satisfied ~ scorePerHit + (1 | user_uuid)` to ask whether *within a participant*, better
  sessions feel more satisfying. A weak or zero correlation is itself an interesting calibration finding.

---

## Group 2 — Trust & influence

### Q2.1 — Does AI condition affect self-reported trust / influence? 🟢
- **Variables:** `trust`, `influence` (survey 1–5) × `ai_advice`.
- **Recommended analysis:** because these are 5-point ordinal items, the principled model is **ordinal
  (cumulative-link) mixed regression** with a random intercept per participant. The dashboard's
  by-condition mean±CI and stacked-Likert views are the descriptive first pass. If treating the Likert
  score as interval (common and often defensible), the Q1.1 mixed model works directly.
- **Confounds & notes:** trust is measured *after* the session, so it reflects the whole experience, not
  a fixed manipulation — it is partly an outcome. Avoid causal language in both directions without the
  mediation framing in Q4.

### Q2.2 — Does trust translate into behavior (following the AI)? 🟢
- **Variables:** `trust` / `influence` × `proxAI` (distance throw → AI suggestion; `null` in `NONE`).
- **Recommended analysis:** Spearman/mixed correlation, **excluding `NONE`** (where `proxAI` is
  undefined). A negative relationship (more trust → smaller distance → closer following) is the
  behavioral validation of the self-report.
- **Confounds & notes:** `proxAI` is mechanically tied to advice quality — in `CORRECT`, following the AI
  also means aiming optimally, so `proxAI` and `proxOptimal` collinearly track each other. Disentangle by
  comparing the trust↔proxAI slope *within* a single condition.

### Q2.3 — Trust trajectory: does trust recover/erode as advice quality changes over a session? 🟡
- **Variables:** `trust` for `GOOD_PLAUSIBLE` vs `PLAUSIBLE_GOOD`.
- **Status:** 🟡 — the survey is **once per session**, so we get one trust value per session, not a
  within-session arc. We can compare end-of-session trust between the two trajectory conditions, but we
  cannot trace the moment-to-moment recovery curve without intra-session trust probes.
- **Recommended analysis:** between-condition contrast on end-of-session `trust` (mirrors Q1.2). To get a
  true arc, either add mid-session survey checkpoints or proxy trust with the *time course of `proxAI`
  across games within a session* (does following increase as advice improves in `PLAUSIBLE_GOOD`?).

---

## Group 3 — Luck attribution

### Q3.1 — Do participants attribute outcomes to luck vs skill appropriately? 🟢
- **Variables:** `luck` (survey, Very Unlucky…Very Lucky) × `dispersion` (hit spread) and × `scorePerHit`.
- **Recommended analysis:** correlate `luck` with `dispersion` and with `scorePerHit` (mixed/Spearman).
  A self-serving-attribution pattern would show high scores attributed to skill (no luck correlation) but
  low scores attributed to bad luck (negative correlation with score) — test by interacting `luck` with
  a high/low-score split.

### Q3.2 — Does the EV gap relate to perceived luck? 🔴 (placeholder EV)
- **Variables:** `evGap` (`scorePerHit − EV`) × `luck`.
- **Status:** 🔴 — `evGap` currently uses a **flat 8/hit placeholder** (`aimingEV.ts`), so any number it
  produces is `scorePerHit − 8`, i.e. a rescaled score, not a true expectation gap. The pairwise scatter
  renders but the inferential question is blocked until the per-board × aim × skill EV JSON lands.
- **Recommended analysis (once unblocked):** `evGap` is the cleanest "luck" proxy — the residual of
  outcome after subtracting what the chosen aim *should* yield. Correlate with self-reported `luck`; a
  strong positive link validates the subjective measure against an objective one.

---

## Group 4 — Mediation & the big picture

### Q4.1 — Does trust *mediate* the effect of AI condition on performance? 🟡
- **Variables:** `ai_advice` → `trust` → `scorePerHit`.
- **Status:** 🟡 — all three variables exist, but mediation needs care about temporal order and the
  within-subjects structure. The correlation heatmap shows the pairwise pieces; it does not establish the
  mediated path.
- **Recommended analysis:** a **mediation model** (e.g., within-participant multilevel mediation, or
  `lavaan`-style SEM if the design is between-subjects) estimating the indirect effect
  `condition → trust → score` with bootstrapped confidence intervals. Pre-specify the direction:
  condition is manipulated, trust is post-session, score is concurrent — so trust mediating score is only
  plausible if trust from *prior* sessions predicts *later* score. Consider a lagged specification.
- **Confounds & notes:** `satisfied` and `trust` are both post-session self-reports and likely collinear;
  decide a priori which is the mediator to avoid a tangled model.

### Q4.2 — Overall cross-variable structure 🟢
- **Variables:** all 9 (`trust`, `influence`, `proxAI`, `satisfied`, `scorePerHit`, `proxOptimal`,
  `luck`, `dispersion`, `evGap`).
- **Recommended analysis:** the dashboard's **Spearman correlation heatmap** (pairwise-complete) is the
  right exploratory tool. For confirmatory structure, a small **factor analysis / PCA** could test whether
  the survey items collapse into fewer latent constructs (e.g., a single "AI-acceptance" factor behind
  trust+influence+satisfied). Treat heatmap cells as hypothesis-generating, not confirmatory — with 9
  variables there are 36 cells and the multiple-comparison risk is real.
- **Confounds & notes:** `evGap` rows/cols are placeholder-contaminated (Q3.2); annotate or exclude them.

---

## Cross-cutting concerns

These affect *every* question above and should be resolved before reporting inferential results.

### C1 — Within- vs between-subjects (Open Question #1)
If a participant cycles through multiple conditions, condition effects are **within-subjects** and we
gain power from paired/repeated-measures models — but we must also worry about **order/carryover
effects** (did seeing `WRONG` earlier sour trust in a later `CORRECT` session?). If each participant sees
one condition, it is between-subjects and we lose the random-slope structure but avoid carryover. **This
single fact changes the recommended model for nearly every question.** Resolve it first.

### C2 — Repeated measures / non-independence
Sessions are nested in participants. Default to **mixed-effects models with `(1 | user_uuid)`**; report
the simpler ANOVA/correlation only as descriptive. Treating ~N sessions as N independent observations
will overstate significance.

### C3 — `execution_skill` as covariate (Open Question #2)
Skill is preset and is the strongest single driver of score. It must enter every performance model as a
covariate. If it is a *derived aggregate* rather than a raw preset, it may be post-treatment (partly an
outcome of the AI), which would make controlling for it inappropriate — clarify its provenance.

### C4 — Multiple comparisons
7 conditions → 21 pairwise contrasts; 9 variables → 36 correlations. Pre-register the **few** contrasts
that matter (Q1.2 trajectory, each condition vs `NONE`) and apply FDR/Dunnett correction to the rest.
The dashboard is exploratory by design; treat its scatters/heatmap as hypothesis-generating.

### C5 — Statistical power / completeness
`MIN_SESSIONS_REQUIRED = 20` defines a "complete" participant. Inferential claims should report how many
complete participants underlie each condition cell and ideally a power/precision estimate — a 7-group
design needs meaningful per-cell n before the trajectory contrast is trustworthy.

### C6 — Board family & seed balance
Score scale differs between Perlin (0–99) and Gaussian (100–199) boards and across seeds. Confirm board
assignment is balanced across conditions, or include it as a covariate, before attributing score
differences to the AI.

---

## Quick status table

| # | Question | Status | Blocker |
|---|---|---|---|
| Q1.1 | AI condition → score | 🟢 | — |
| Q1.2 | Advice trajectory (5 vs 6) → score | 🟢 | — (primary) |
| Q1.3 | AI → proximity to optimal aim | 🟢 | — |
| Q1.4 | Satisfaction calibrated to score | 🟢 | — |
| Q2.1 | Condition → trust / influence | 🟢 | — |
| Q2.2 | Trust → following behavior (proxAI) | 🟢 | — |
| Q2.3 | Trust trajectory arc | 🟡 | survey is once/session, not intra-session |
| Q3.1 | Luck attribution vs dispersion/score | 🟢 | — |
| Q3.2 | EV gap ↔ perceived luck | 🔴 | flat EV placeholder |
| Q4.1 | Trust mediates condition → performance | 🟡 | temporal/design structure |
| Q4.2 | Overall cross-variable structure | 🟢 | — (exploratory) |

---

## Open questions that would unlock more

1. **Design structure** (within/between) — gates the model choice for almost everything (C1).
2. **EV dataset** — unblocks Q3.2 and de-contaminates the `evGap` heatmap rows (C6, Q4.2).
3. **`execution_skill` provenance** — determines whether it is a valid covariate or a post-treatment
   variable (C3).
4. **Intra-session survey probes** — would turn the trajectory trust question (Q2.3) from an end-state
   comparison into a true recovery curve.
