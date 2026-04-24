import { AI_Type } from "../types/dart";
import type { RewardSurface } from "../types/dart";
import type { Answer } from "../types/survey";
import type { ParsedGameSession, ParsedSurveyResponse } from "../loaders/loadData";
import { AI_TYPE_COLORS, AI_TYPE_LABELS } from "./stats";
import { computeSessionScore, computeGameProximity, computeGameDurationSecs } from "./scoreStats";

const LIKERT_SCALE: Record<string, number> = {
  "strongly disagree": 1,
  "disagree": 2,
  "neutral": 3,
  "neither agree nor disagree": 3,
  "agree": 4,
  "strongly agree": 5,
};

export function getAnswerValue(responses: Answer[], questionId: string): number | null {
  const answer = responses.find((r) => r.questionId === questionId);
  if (answer === undefined) return null;
  if (typeof answer.value === "number") return answer.value;
  if (typeof answer.value === "string") {
    const trimmed = answer.value.trim();
    const n = Number(trimmed);
    if (!Number.isNaN(n) && trimmed !== "") return n;
    return LIKERT_SCALE[trimmed.toLowerCase()] ?? null;
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
  stdDev: number;
  ci95: number;
  min: number;
  max: number;
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
      return { aiType: type, label: AI_TYPE_LABELS[type], color: AI_TYPE_COLORS[type], count: 0, mean: 0, stdDev: 0, ci95: 0, min: 0, max: 0 };
    }
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
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
      stdDev: sd,
      ci95,
      min: Math.min(...values),
      max: Math.max(...values),
    };
  });
}

export interface TrustTimePoint {
  date: string;
  trust: number;
  aiType: AI_Type;
  label: string;
  color: string;
}

export function computeTrustOverTime(
  joined: JoinedSessionSurvey[],
  trustQuestionId: string,
): TrustTimePoint[] {
  return joined
    .flatMap(({ session, survey }) => {
      if (!survey) return [];
      const trust = getAnswerValue(survey.responses, trustQuestionId);
      if (trust === null) return [];
      return [{
        date: session.created_at.slice(0, 10),
        trust,
        aiType: session.ai_advice,
        label: AI_TYPE_LABELS[session.ai_advice],
        color: AI_TYPE_COLORS[session.ai_advice],
      }];
    })
    .sort((a, b) => a.date.localeCompare(b.date));
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
