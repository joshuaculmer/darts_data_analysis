import { AI_Type } from "../types/dart";
import type { ParsedGameSession } from "../loaders/loadData";

export interface Kpis {
  totalSessions: number;
  uniqueParticipants: number;
  avgSkill: number;
  avgGamesPlayed: number;
}

export function computeKpis(sessions: ParsedGameSession[]): Kpis {
  const totalSessions = sessions.length;
  if (totalSessions === 0) {
    return { totalSessions: 0, uniqueParticipants: 0, avgSkill: 0, avgGamesPlayed: 0 };
  }
  const uniqueParticipants = new Set(sessions.map((s) => s.user_uuid)).size;
  const avgSkill = sessions.reduce((sum, s) => sum + s.execution_skill, 0) / totalSessions;
  const avgGamesPlayed = sessions.reduce((sum, s) => sum + s.games_played, 0) / totalSessions;
  return { totalSessions, uniqueParticipants, avgSkill, avgGamesPlayed };
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
  [AI_Type.NONE]: "#94a3b8",
  [AI_Type.CORRECT]: "#22c55e",
  [AI_Type.RANDOM]: "#f59e0b",
  [AI_Type.WRONG]: "#ef4444",
  [AI_Type.BAD]: "#f97316",
  [AI_Type.GOOD_BAD]: "#8b5cf6",
  [AI_Type.BAD_GOOD]: "#06b6d4",
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
