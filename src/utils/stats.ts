import { AI_Type } from "../types/dart";
import type { ParsedGameSession, ParsedSurveyResponse } from "../loaders/loadData";

// Change this to update the completeness threshold everywhere at once
export const MIN_SESSIONS_REQUIRED = 5;

export interface Kpis {
  uniqueParticipants: number;
  completeParticipants: number;
  avgSessionsPerParticipant: number;
  avgTimePerSessionMs: number;
  avgTotalTimeMs: number;
}

export function computeKpis(
  sessions: ParsedGameSession[],
  surveyResponses: ParsedSurveyResponse[],
): Kpis {
  const empty: Kpis = {
    uniqueParticipants: 0,
    completeParticipants: 0,
    avgSessionsPerParticipant: 0,
    avgTimePerSessionMs: 0,
    avgTotalTimeMs: 0,
  };
  if (sessions.length === 0) return empty;

  const sessionsByUser = sessions.reduce<Record<string, ParsedGameSession[]>>((acc, s) => {
    (acc[s.user_uuid] ??= []).push(s);
    return acc;
  }, {});

  const surveyCountByUser = surveyResponses.reduce<Record<string, number>>((acc, r) => {
    acc[r.user_uuid] = (acc[r.user_uuid] ?? 0) + 1;
    return acc;
  }, {});

  const userIds = Object.keys(sessionsByUser);
  const uniqueParticipants = userIds.length;
  const avgSessionsPerParticipant =
    userIds.reduce((sum, uuid) => sum + sessionsByUser[uuid].length, 0) / uniqueParticipants;

  const completeUserIds = userIds.filter((uuid) => {
    const sc = sessionsByUser[uuid].length;
    const rc = surveyCountByUser[uuid] ?? 0;
    return sc === MIN_SESSIONS_REQUIRED && rc === MIN_SESSIONS_REQUIRED;
  });

  let avgTimePerSessionMs = 0;
  let avgTotalTimeMs = 0;

  if (completeUserIds.length > 0) {
    const perUser: { avgGap: number; sessionCount: number }[] = [];

    for (const uuid of completeUserIds) {
      const sorted = [...sessionsByUser[uuid]].sort((a, b) =>
        a.created_at.localeCompare(b.created_at),
      );
      const gaps: number[] = [];
      for (let i = 1; i < sorted.length; i++) {
        gaps.push(
          new Date(sorted[i].created_at).getTime() -
            new Date(sorted[i - 1].created_at).getTime(),
        );
      }
      if (gaps.length > 0) {
        const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
        perUser.push({ avgGap, sessionCount: sorted.length });
      }
    }

    if (perUser.length > 0) {
      avgTimePerSessionMs =
        perUser.reduce((s, d) => s + d.avgGap, 0) / perUser.length;
      // Total per user = avgGap × sessionCount (the ×N accounts for N-1 measured
      // gaps plus one estimated gap for the first session)
      avgTotalTimeMs =
        perUser.reduce((s, d) => s + d.avgGap * d.sessionCount, 0) / perUser.length;
    }
  }

  return {
    uniqueParticipants,
    completeParticipants: completeUserIds.length,
    avgSessionsPerParticipant,
    avgTimePerSessionMs,
    avgTotalTimeMs,
  };
}

export interface DateCount {
  date: string;
  count: number;
}

export function groupSessionsByDate(sessions: ParsedGameSession[]): DateCount[] {
  const counts = sessions.reduce<Record<string, number>>((acc, s) => {
    const date = s.created_at.slice(0, 10);
    acc[date] = (acc[date] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}

export const AI_TYPE_LABELS: Record<AI_Type, string> = {
  [AI_Type.NONE]: "None",
  [AI_Type.CORRECT]: "Correct",
  [AI_Type.RANDOM]: "Random",
  [AI_Type.WRONG]: "Wrong",
  [AI_Type.BAD]: "Bad",
  [AI_Type.GOOD_BAD]: "Good→Bad",
  [AI_Type.BAD_GOOD]: "Bad→Good",
};

export const AI_TYPE_COLORS: Record<AI_Type, string> = {
  [AI_Type.NONE]: "#6b7280",
  [AI_Type.CORRECT]: "#0072B2",
  [AI_Type.RANDOM]: "#E69F00",
  [AI_Type.WRONG]: "#D55E00",
  [AI_Type.BAD]: "#CC79A7",
  [AI_Type.GOOD_BAD]: "#009E73",
  [AI_Type.BAD_GOOD]: "#56B4E9",
};

export interface ConditionCount {
  aiType: AI_Type;
  label: string;
  color: string;
  sessions: number;
}

// ---------------------------------------------------------------------------
// Phase 2 stats
// ---------------------------------------------------------------------------

function sortedValues(sessions: ParsedGameSession[]): number[] {
  return sessions.map((s) => s.execution_skill).sort((a, b) => a - b);
}

function arrayMedian(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function arrayQuartiles(sorted: number[]): { q1: number; q2: number; q3: number } {
  const n = sorted.length;
  if (n === 0) return { q1: 0, q2: 0, q3: 0 };
  const q2 = arrayMedian(sorted);
  const mid = Math.floor(n / 2);
  const lower = sorted.slice(0, mid);
  const upper = sorted.slice(n % 2 === 1 ? mid + 1 : mid);
  return {
    q1: lower.length > 0 ? arrayMedian(lower) : q2,
    q2,
    q3: upper.length > 0 ? arrayMedian(upper) : q2,
  };
}

function sampleStdDev(values: number[], mean: number): number {
  if (values.length < 2) return 0;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export interface ConditionStats {
  aiType: AI_Type;
  label: string;
  color: string;
  count: number;
  mean: number;
  stdDev: number;
  ci95: number;
  median: number;
  q1: number;
  q3: number;
  min: number;
  max: number;
}

export function computeConditionStats(sessions: ParsedGameSession[]): ConditionStats[] {
  const grouped = sessions.reduce<Partial<Record<AI_Type, ParsedGameSession[]>>>((acc, s) => {
    (acc[s.ai_advice] ??= []).push(s);
    return acc;
  }, {});

  return (Object.values(AI_Type).filter((v) => typeof v === "number") as AI_Type[]).map((type) => {
    const group = grouped[type] ?? [];
    if (group.length === 0) {
      return { aiType: type, label: AI_TYPE_LABELS[type], color: AI_TYPE_COLORS[type], count: 0, mean: 0, stdDev: 0, ci95: 0, median: 0, q1: 0, q3: 0, min: 0, max: 0 };
    }
    const sorted = sortedValues(group);
    const mean = sorted.reduce((s, v) => s + v, 0) / sorted.length;
    const stdDev = sampleStdDev(sorted, mean);
    const ci95 = sorted.length > 1 ? (1.96 * stdDev) / Math.sqrt(sorted.length) : 0;
    const { q1, q2: median, q3 } = arrayQuartiles(sorted);
    return {
      aiType: type,
      label: AI_TYPE_LABELS[type],
      color: AI_TYPE_COLORS[type],
      count: sorted.length,
      mean,
      stdDev,
      ci95,
      median,
      q1,
      q3,
      min: sorted[0],
      max: sorted[sorted.length - 1],
    };
  });
}

export interface ScatterPoint {
  gamesPlayed: number;
  executionSkill: number;
  aiType: AI_Type;
  label: string;
  color: string;
}

export function computeScatterPoints(sessions: ParsedGameSession[]): ScatterPoint[] {
  return sessions.map((s) => ({
    gamesPlayed: s.games_played,
    executionSkill: s.execution_skill,
    aiType: s.ai_advice,
    label: AI_TYPE_LABELS[s.ai_advice],
    color: AI_TYPE_COLORS[s.ai_advice],
  }));
}

export interface UserConditionRow {
  user_uuid: string;
  user_nickname: string | null;
  byCondition: Partial<Record<AI_Type, number>>;
}

export function computeUserConditionAverages(sessions: ParsedGameSession[]): UserConditionRow[] {
  // Group sessions by user, then by condition
  const byUser = sessions.reduce<
    Record<string, { nickname: string | null; byCondition: Partial<Record<AI_Type, number[]>> }>
  >((acc, s) => {
    if (!acc[s.user_uuid]) {
      acc[s.user_uuid] = { nickname: s.user_nickname, byCondition: {} };
    }
    const cond = acc[s.user_uuid].byCondition;
    (cond[s.ai_advice] ??= []).push(s.execution_skill);
    return acc;
  }, {});

  return Object.entries(byUser).map(([user_uuid, { nickname, byCondition }]) => ({
    user_uuid,
    user_nickname: nickname,
    byCondition: Object.fromEntries(
      Object.entries(byCondition).map(([type, values]) => [
        type,
        (values as number[]).reduce((s, v) => s + v, 0) / (values as number[]).length,
      ]),
    ) as Partial<Record<AI_Type, number>>,
  }));
}

export interface DateParticipantCount {
  date: string;
  count: number;
}

export function groupParticipantsByDate(sessions: ParsedGameSession[]): DateParticipantCount[] {
  const byDate = sessions.reduce<Record<string, Set<string>>>((acc, s) => {
    const date = s.created_at.slice(0, 10);
    (acc[date] ??= new Set()).add(s.user_uuid);
    return acc;
  }, {});
  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, uuids]) => ({ date, count: uuids.size }));
}

export function getCompleteUserIds(
  sessions: ParsedGameSession[],
  surveyResponses: ParsedSurveyResponse[],
): Set<string> {
  const sessionCountByUser = sessions.reduce<Record<string, number>>((acc, s) => {
    acc[s.user_uuid] = (acc[s.user_uuid] ?? 0) + 1;
    return acc;
  }, {});
  const surveyCountByUser = surveyResponses.reduce<Record<string, number>>((acc, r) => {
    acc[r.user_uuid] = (acc[r.user_uuid] ?? 0) + 1;
    return acc;
  }, {});
  const ids = new Set<string>();
  for (const [uuid, count] of Object.entries(sessionCountByUser)) {
    if (count === MIN_SESSIONS_REQUIRED && (surveyCountByUser[uuid] ?? 0) === MIN_SESSIONS_REQUIRED) {
      ids.add(uuid);
    }
  }
  return ids;
}

export function countByCondition(sessions: ParsedGameSession[]): ConditionCount[] {
  const counts = sessions.reduce<Partial<Record<AI_Type, number>>>((acc, s) => {
    acc[s.ai_advice] = (acc[s.ai_advice] ?? 0) + 1;
    return acc;
  }, {});

  return (Object.values(AI_Type).filter((v) => typeof v === "number") as AI_Type[]).map((type) => ({
    aiType: type,
    label: AI_TYPE_LABELS[type],
    color: AI_TYPE_COLORS[type],
    sessions: counts[type] ?? 0,
  }));
}
