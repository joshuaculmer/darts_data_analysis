import type { AI_Type } from "../types/dart";
import type { RewardSurface } from "../types/dart";
import type { JoinedSessionSurvey } from "./surveyStats";
import { getAnswerValue } from "./surveyStats";
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
