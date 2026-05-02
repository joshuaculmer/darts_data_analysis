import { AI_Type } from "../types/dart";
import type { RewardSurface } from "../types/dart";
import type { Answer } from "../types/survey";
import type { ParsedGameSession, ParsedSurveyResponse } from "../loaders/loadData";
import { AI_TYPE_COLORS, AI_TYPE_LABELS } from "./stats";
import { computeSessionScore, computeGameProximity, computeGameDurationSecs } from "./scoreStats";
import { ORDINAL_SCALES } from "./surveyScales";

export function getAnswerValue(responses: Answer[], questionId: string): number | null {
  const answer = responses.find((r) => r.questionId === questionId);
  if (answer === undefined) return null;
  if (typeof answer.value === "number") return answer.value;
  if (typeof answer.value === "string") {
    const trimmed = answer.value.trim();
    const n = Number(trimmed);
    if (!Number.isNaN(n) && trimmed !== "") return n;
    return ORDINAL_SCALES[trimmed.toLowerCase()] ?? null;
  }
  return null;
}

export interface JoinedSessionSurvey {
  session: ParsedGameSession;
  survey: ParsedSurveyResponse | null;
}

export function joinSessionsWithSurvey(
  sessions: ParsedGameSession[],
  surveys: ParsedSurveyResponse[],
): JoinedSessionSurvey[] {
  return sessions.map((session) => {
    const candidates = surveys.filter((s) => s.user_uuid === session.user_uuid);
    if (candidates.length === 0) return { session, survey: null };

    const sessionTime = new Date(session.created_at).getTime();

    // In the study design, participants fill out the survey after each session.
    // Prefer surveys submitted after the session so that earlier sessions don't
    // steal surveys that belong to later ones.
    const afterSession = candidates.filter(
      (s) => new Date(s.created_at).getTime() >= sessionTime,
    );
    const pool = afterSession.length > 0 ? afterSession : candidates;

    const nearest = pool.reduce((best, s) => {
      const sDiff = Math.abs(new Date(s.created_at).getTime() - sessionTime);
      const bDiff = Math.abs(new Date(best.created_at).getTime() - sessionTime);
      return sDiff < bDiff ? s : best;
    });
    return { session, survey: nearest };
  });
}

export interface TrustConditionStats {
  aiType: AI_Type;
  label: string;
  color: string;
  count: number;
  mean: number;
  median: number;
  q1: number;
  q3: number;
  stdDev: number;
  ci95: number;
  min: number;
  max: number;
}

export interface TrustSessionStats {
  sessionIndex: number;
  label: string;
  count: number;
  mean: number;
  median: number;
  q1: number;
  q3: number;
  stdDev: number;
  ci95: number;
  min: number;
  max: number;
}

export interface LikertBreakdown {
  count1: number;
  count2: number;
  count3: number;
  count4: number;
  count5: number;
  pct1: number;
  pct2: number;
  pct3: number;
  pct4: number;
  pct5: number;
}

export interface TrustConditionLikertBreakdown extends LikertBreakdown {
  aiType: AI_Type;
  label: string;
  color: string;
  count: number;
}

export interface TrustSessionLikertBreakdown extends LikertBreakdown {
  sessionIndex: number;
  label: string;
  count: number;
}

function countLikert(values: number[]): LikertBreakdown {
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>;
  values.forEach((value) => {
    const rounded = Math.round(value) as 1 | 2 | 3 | 4 | 5;
    if (rounded >= 1 && rounded <= 5) counts[rounded] += 1;
  });
  const total = values.length;
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);
  return {
    count1: counts[1],
    count2: counts[2],
    count3: counts[3],
    count4: counts[4],
    count5: counts[5],
    pct1: pct(counts[1]),
    pct2: pct(counts[2]),
    pct3: pct(counts[3]),
    pct4: pct(counts[4]),
    pct5: pct(counts[5]),
  };
}

function quantileSorted(sortedValues: number[], q: number): number {
  if (sortedValues.length === 0) return 0;
  const pos = (sortedValues.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sortedValues[base + 1];
  if (next === undefined) return sortedValues[base];
  return sortedValues[base] + rest * (next - sortedValues[base]);
}

export function computeTrustByCondition(
  joined: JoinedSessionSurvey[],
  trustQuestionId: string,
): TrustConditionStats[] {
  const grouped = joined.reduce<Partial<Record<AI_Type, number[]>>>((acc, { session, survey }) => {
    if (!survey) return acc;
    const trust = getAnswerValue(survey.responses, trustQuestionId);
    if (trust === null) return acc;
    (acc[session.ai_advice] ??= []).push(trust);
    return acc;
  }, {});

  return (Object.values(AI_Type).filter((v) => typeof v === "number") as AI_Type[]).map((type) => {
    const values = grouped[type] ?? [];
    if (values.length === 0) {
      return {
        aiType: type,
        label: AI_TYPE_LABELS[type],
        color: AI_TYPE_COLORS[type],
        count: 0,
        mean: 0,
        median: 0,
        q1: 0,
        q3: 0,
        stdDev: 0,
        ci95: 0,
        min: 0,
        max: 0,
      };
    }
    const sorted = [...values].sort((a, b) => a - b);
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const median = quantileSorted(sorted, 0.5);
    const q1 = quantileSorted(sorted, 0.25);
    const q3 = quantileSorted(sorted, 0.75);
    const variance = values.length > 1
      ? values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1)
      : 0;
    const sd = Math.sqrt(variance);
    const ci95 = values.length > 1 ? (1.96 * sd) / Math.sqrt(values.length) : 0;
    return {
      aiType: type,
      label: AI_TYPE_LABELS[type],
      color: AI_TYPE_COLORS[type],
      count: values.length,
      mean,
      median,
      q1,
      q3,
      stdDev: sd,
      ci95,
      min: Math.min(...values),
      max: Math.max(...values),
    };
  });
}

export function computeTrustLikertByCondition(
  joined: JoinedSessionSurvey[],
  trustQuestionId: string,
): TrustConditionLikertBreakdown[] {
  const grouped = joined.reduce<Partial<Record<AI_Type, number[]>>>((acc, { session, survey }) => {
    if (!survey) return acc;
    const trust = getAnswerValue(survey.responses, trustQuestionId);
    if (trust === null) return acc;
    (acc[session.ai_advice] ??= []).push(trust);
    return acc;
  }, {});

  return (Object.values(AI_Type).filter((v) => typeof v === "number") as AI_Type[]).map((type) => {
    const values = grouped[type] ?? [];
    return {
      aiType: type,
      label: AI_TYPE_LABELS[type],
      color: AI_TYPE_COLORS[type],
      count: values.length,
      ...countLikert(values),
    };
  });
}

export function computeTrustBySession(
  joined: JoinedSessionSurvey[],
  trustQuestionId: string,
): TrustSessionStats[] {
  // Number sessions per participant by timestamp, then aggregate trust by session number.
  const byUser = new Map<string, Array<{ created_at: string; trust: number }>>();
  for (const { session, survey } of joined) {
    if (!survey) continue;
    const trust = getAnswerValue(survey.responses, trustQuestionId);
    if (trust === null) continue;
    const entries = byUser.get(session.user_uuid) ?? [];
    entries.push({ created_at: session.created_at, trust });
    byUser.set(session.user_uuid, entries);
  }

  const groupedBySession = new Map<number, number[]>();
  for (const entries of byUser.values()) {
    entries.sort((a, b) => a.created_at.localeCompare(b.created_at));
    entries.forEach(({ trust }, idx) => {
      const sessionIndex = idx + 1;
      const values = groupedBySession.get(sessionIndex) ?? [];
      values.push(trust);
      groupedBySession.set(sessionIndex, values);
    });
  }

  return [...groupedBySession.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([sessionIndex, values]) => {
      const sorted = [...values].sort((a, b) => a - b);
      const mean = values.reduce((s, v) => s + v, 0) / values.length;
      const median = quantileSorted(sorted, 0.5);
      const q1 = quantileSorted(sorted, 0.25);
      const q3 = quantileSorted(sorted, 0.75);
      const variance = values.length > 1
        ? values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1)
        : 0;
      const sd = Math.sqrt(variance);
      const ci95 = values.length > 1 ? (1.96 * sd) / Math.sqrt(values.length) : 0;
      return {
        sessionIndex,
        label: `Session ${sessionIndex}`,
        count: values.length,
        mean,
        median,
        q1,
        q3,
        stdDev: sd,
        ci95,
        min: Math.min(...values),
        max: Math.max(...values),
      };
    });
}

export function computeTrustLikertBySession(
  joined: JoinedSessionSurvey[],
  trustQuestionId: string,
): TrustSessionLikertBreakdown[] {
  // Number sessions per participant by timestamp, then aggregate trust by session number.
  const byUser = new Map<string, Array<{ created_at: string; trust: number }>>();
  for (const { session, survey } of joined) {
    if (!survey) continue;
    const trust = getAnswerValue(survey.responses, trustQuestionId);
    if (trust === null) continue;
    const entries = byUser.get(session.user_uuid) ?? [];
    entries.push({ created_at: session.created_at, trust });
    byUser.set(session.user_uuid, entries);
  }

  const groupedBySession = new Map<number, number[]>();
  for (const entries of byUser.values()) {
    entries.sort((a, b) => a.created_at.localeCompare(b.created_at));
    entries.forEach(({ trust }, idx) => {
      const sessionIndex = idx + 1;
      const values = groupedBySession.get(sessionIndex) ?? [];
      values.push(trust);
      groupedBySession.set(sessionIndex, values);
    });
  }

  return [...groupedBySession.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([sessionIndex, values]) => ({
      sessionIndex,
      label: `Session ${sessionIndex}`,
      count: values.length,
      ...countLikert(values),
    }));
}

export interface TrustTimePoint {
  sessionIndex: number;
  trust: number;
  aiType: AI_Type;
  label: string;
  color: string;
  user_uuid: string;
}

export function computeTrustOverTime(
  joined: JoinedSessionSurvey[],
  trustQuestionId: string,
): TrustTimePoint[] {
  // Collect valid pairs per participant so we can number sessions 1, 2, 3…
  const byUser = new Map<string, Array<{ created_at: string; trust: number; aiType: AI_Type }>>();
  for (const { session, survey } of joined) {
    if (!survey) continue;
    const trust = getAnswerValue(survey.responses, trustQuestionId);
    if (trust === null) continue;
    const entries = byUser.get(session.user_uuid) ?? [];
    entries.push({ created_at: session.created_at, trust, aiType: session.ai_advice });
    byUser.set(session.user_uuid, entries);
  }

  const result: TrustTimePoint[] = [];
  for (const [uuid, entries] of byUser.entries()) {
    entries.sort((a, b) => a.created_at.localeCompare(b.created_at));
    entries.forEach(({ trust, aiType }, idx) => {
      result.push({
        sessionIndex: idx + 1,
        trust,
        aiType,
        label: AI_TYPE_LABELS[aiType],
        color: AI_TYPE_COLORS[aiType],
        user_uuid: uuid,
      });
    });
  }

  return result.sort((a, b) => a.sessionIndex - b.sessionIndex);
}

export interface TrustScorePoint {
  trust: number;
  score: number;
  aiType: AI_Type;
  label: string;
  color: string;
  session: ParsedGameSession;
}

export function computeTrustVsScorePoints(
  joined: JoinedSessionSurvey[],
  trustQuestionId: string,
  boards: Map<number, RewardSurface>,
): TrustScorePoint[] {
  return joined.flatMap(({ session, survey }) => {
    if (!survey) return [];
    const trust = getAnswerValue(survey.responses, trustQuestionId);
    if (trust === null) return [];
    return [{
      trust,
      score: computeSessionScore(session, boards).avg,
      aiType: session.ai_advice,
      label: AI_TYPE_LABELS[session.ai_advice],
      color: AI_TYPE_COLORS[session.ai_advice],
      session,
    }];
  });
}

export interface TrustVsTimePoint {
  trust: number;
  avgTimeSecs: number;
  aiType: AI_Type;
  label: string;
  color: string;
  session: ParsedGameSession;
}

export function computeTrustVsTimePoints(
  joined: JoinedSessionSurvey[],
  trustQuestionId: string,
): TrustVsTimePoint[] {
  return joined.flatMap(({ session, survey }) => {
    if (!survey || session.games.length === 0) return [];
    const trust = getAnswerValue(survey.responses, trustQuestionId);
    if (trust === null) return [];
    const avgTimeSecs =
      session.games.reduce((s, g) => s + computeGameDurationSecs(g), 0) / session.games.length;
    return [{
      trust,
      avgTimeSecs,
      aiType: session.ai_advice,
      label: AI_TYPE_LABELS[session.ai_advice],
      color: AI_TYPE_COLORS[session.ai_advice],
      session,
    }];
  });
}

export interface TrustVsProximityPoint {
  trust: number;
  avgProximity: number | null;
  aiType: AI_Type;
  label: string;
  color: string;
  session: ParsedGameSession;
}

export function computeTrustVsProximityPoints(
  joined: JoinedSessionSurvey[],
  trustQuestionId: string,
): TrustVsProximityPoint[] {
  return joined.flatMap(({ session, survey }) => {
    if (!survey) return [];
    const trust = getAnswerValue(survey.responses, trustQuestionId);
    if (trust === null) return [];
    const proximities = session.games
      .map(computeGameProximity)
      .filter((p): p is number => p !== null);
    const avgProximity =
      proximities.length > 0
        ? proximities.reduce((s, v) => s + v, 0) / proximities.length
        : null;
    return [{
      trust,
      avgProximity,
      aiType: session.ai_advice,
      label: AI_TYPE_LABELS[session.ai_advice],
      color: AI_TYPE_COLORS[session.ai_advice],
      session,
    }];
  });
}
