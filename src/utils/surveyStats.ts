import { AI_Type } from "../types/dart";
import type { RewardSurface } from "../types/dart";
import type { Answer } from "../types/survey";
import type { ParsedGameSession, ParsedSurveyResponse } from "../loaders/loadData";
import { AI_TYPE_COLORS, AI_TYPE_LABELS } from "./stats";
import { computeSessionScore } from "./scoreStats";

export function getAnswerValue(responses: Answer[], questionId: string): number | null {
  const answer = responses.find((r) => r.questionId === questionId);
  if (answer === undefined) return null;
  return typeof answer.value === "number" ? answer.value : null;
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
    const nearest = candidates.reduce((best, s) => {
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
    }];
  });
}
