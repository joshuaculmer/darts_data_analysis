import { AI_Type } from "../types/dart";
import type { RewardSurface } from "../types/dart";
import type { JoinedSessionSurvey } from "./surveyStats";
import { getAnswerValue } from "./surveyStats";
import { AI_TYPE_COLORS, AI_TYPE_LABELS } from "./stats";
import {
  computeGameProximity,
  computeGameOptimalProximity,
  computeSessionScorePerHit,
  computeSessionHitDispersion,
  computeSessionEvGap,
} from "./scoreStats";
import type { VariableGroup } from "./surveyScales";
import { AGREEMENT_LABELS, LUCK_LABELS, formatScaleValue } from "./surveyScales";

/**
 * The unified, session-level variable set (9 variables across 3 research
 * groups). One {@link SessionVariableRow} is produced per session and drives
 * the group pages, the global correlation heatmap, and Raw Data columns.
 *
 * Survey-derived variables (trust/influence/satisfied/luck) are null when the
 * session has no matching survey. Game-derived continuous metrics
 * (scorePerHit/dispersion/evGap) are null when the session has no games.
 * Proximity variables are null when no game supplies the needed coordinate
 * (e.g. proxAI in the NONE condition).
 */
export type VariableKey =
  | "trust"
  | "influence"
  | "proxAI"
  | "satisfied"
  | "scorePerHit"
  | "proxOptimal"
  | "luck"
  | "dispersion"
  | "evGap";

export interface SessionVariableRow {
  user_uuid: string;
  /** Index into the joined array — used for click-to-navigate to Session View. */
  sessionIndex: number;
  ai_advice: AI_Type;
  trust: number | null;
  influence: number | null;
  proxAI: number | null;
  satisfied: number | null;
  scorePerHit: number | null;
  proxOptimal: number | null;
  luck: number | null;
  dispersion: number | null;
  evGap: number | null;
}

function meanOrNull(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) return null;
  return present.reduce((s, v) => s + v, 0) / present.length;
}

export function buildSessionVariableRows(
  joined: JoinedSessionSurvey[],
  boards: Map<number, RewardSurface>,
): SessionVariableRow[] {
  return joined.map(({ session, survey }, sessionIndex) => {
    const hasGames = session.games.length > 0;

    const proxAI = hasGames
      ? meanOrNull(session.games.map(computeGameProximity))
      : null;
    const proxOptimal = hasGames
      ? meanOrNull(
          session.games.map((g) => computeGameOptimalProximity(g, session.execution_skill)),
        )
      : null;

    return {
      user_uuid: session.user_uuid,
      sessionIndex,
      ai_advice: session.ai_advice,
      trust: survey ? getAnswerValue(survey.responses, "trust") : null,
      influence: survey ? getAnswerValue(survey.responses, "influence") : null,
      satisfied: survey ? getAnswerValue(survey.responses, "satisfied") : null,
      luck: survey ? getAnswerValue(survey.responses, "luck") : null,
      proxAI,
      proxOptimal,
      scorePerHit: hasGames ? computeSessionScorePerHit(session, boards) : null,
      dispersion: hasGames ? computeSessionHitDispersion(session).mean : null,
      evGap: hasGames ? computeSessionEvGap(session, boards) : null,
    };
  });
}

export interface VariableDef {
  key: VariableKey;
  label: string;
  group: VariableGroup;
  accessor: (row: SessionVariableRow) => number | null;
  format: (value: number) => string;
}

const px = (v: number) => `${v.toFixed(1)} px`;
const pts = (v: number) => v.toFixed(2);
const agreement = (v: number) => formatScaleValue(v, AGREEMENT_LABELS);

export const VARIABLES: Record<VariableKey, VariableDef> = {
  trust: { key: "trust", label: "Trust", group: "trust", accessor: (r) => r.trust, format: agreement },
  influence: { key: "influence", label: "Influence", group: "trust", accessor: (r) => r.influence, format: agreement },
  proxAI: { key: "proxAI", label: "Proximity to AI", group: "trust", accessor: (r) => r.proxAI, format: px },
  satisfied: { key: "satisfied", label: "Satisfaction", group: "performance", accessor: (r) => r.satisfied, format: agreement },
  scorePerHit: { key: "scorePerHit", label: "Score / Hit", group: "performance", accessor: (r) => r.scorePerHit, format: pts },
  proxOptimal: { key: "proxOptimal", label: "Proximity to Optimal", group: "performance", accessor: (r) => r.proxOptimal, format: px },
  luck: { key: "luck", label: "Luck", group: "luck", accessor: (r) => r.luck, format: (v) => formatScaleValue(v, LUCK_LABELS) },
  dispersion: { key: "dispersion", label: "Hit Dispersion", group: "luck", accessor: (r) => r.dispersion, format: px },
  evGap: { key: "evGap", label: "EV Gap", group: "luck", accessor: (r) => r.evGap, format: pts },
};

export interface VariableConditionStats {
  aiType: AI_Type;
  label: string;
  color: string;
  count: number;
  mean: number;
  stdDev: number;
  ci95: number;
}

/**
 * Mean (± 95% CI) of one variable grouped by AI condition, across session
 * variable rows. Null values are dropped per condition. Returns an entry for
 * all 7 conditions in AI_Type order so charts keep a stable x-axis. Powers the
 * "X by condition" charts on the group pages for continuous game-derived
 * variables (scorePerHit, dispersion, evGap, proximities).
 */
export function computeVariableByCondition(
  rows: SessionVariableRow[],
  key: VariableKey,
): VariableConditionStats[] {
  const accessor = VARIABLES[key].accessor;
  const grouped = rows.reduce<Partial<Record<AI_Type, number[]>>>((acc, r) => {
    const v = accessor(r);
    if (v === null) return acc;
    (acc[r.ai_advice] ??= []).push(v);
    return acc;
  }, {});

  return (Object.values(AI_Type).filter((v) => typeof v === "number") as AI_Type[]).map((type) => {
    const values = grouped[type] ?? [];
    const base = { aiType: type, label: AI_TYPE_LABELS[type], color: AI_TYPE_COLORS[type] };
    if (values.length === 0) return { ...base, count: 0, mean: 0, stdDev: 0, ci95: 0 };
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance =
      values.length > 1
        ? values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1)
        : 0;
    const sd = Math.sqrt(variance);
    const ci95 = values.length > 1 ? (1.96 * sd) / Math.sqrt(values.length) : 0;
    return { ...base, count: values.length, mean, stdDev: sd, ci95 };
  });
}

/** Variable keys in canonical display order (Trust → Performance → Luck). */
export const VARIABLE_KEYS: VariableKey[] = [
  "trust",
  "influence",
  "proxAI",
  "satisfied",
  "scorePerHit",
  "proxOptimal",
  "luck",
  "dispersion",
  "evGap",
];
