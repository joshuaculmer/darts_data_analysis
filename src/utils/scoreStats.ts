import { AI_Type } from "../types/dart";
import type { DartGameDTO, RewardSurface } from "../types/dart";
import type { ParsedGameSession } from "../loaders/loadData";
import { AI_TYPE_COLORS, AI_TYPE_LABELS } from "./stats";

export function gameScore(game: DartGameDTO, surface: RewardSurface): number {
  return game.hits.reduce((sum, hit) => {
    const x = Math.floor(hit.x);
    const y = Math.floor(hit.y);
    return sum + (surface[x]?.[y] ?? 0);
  }, 0);
}

export interface SessionScore {
  gameScores: number[];
  sum: number;
  avg: number;
}

export function computeSessionScore(
  session: ParsedGameSession,
  boards: Map<number, RewardSurface>,
): SessionScore {
  const gameScores = session.games.map((game) => {
    const surface = boards.get(game.board_id);
    return surface ? gameScore(game, surface) : 0;
  });
  const sum = gameScores.reduce((s, v) => s + v, 0);
  const avg = gameScores.length > 0 ? sum / gameScores.length : 0;
  return { gameScores, sum, avg };
}

export function computeAllSessionScores(
  sessions: ParsedGameSession[],
  boards: Map<number, RewardSurface>,
): SessionScore[] {
  return sessions.map((s) => computeSessionScore(s, boards));
}

export interface ParticipantScore {
  user_uuid: string;
  totalScore: number;
}

export function computeParticipantTotalScores(
  sessions: ParsedGameSession[],
  boards: Map<number, RewardSurface>,
): ParticipantScore[] {
  const totals = new Map<string, number>();
  for (const session of sessions) {
    const { sum } = computeSessionScore(session, boards);
    totals.set(session.user_uuid, (totals.get(session.user_uuid) ?? 0) + sum);
  }
  return [...totals.entries()].map(([user_uuid, totalScore]) => ({ user_uuid, totalScore }));
}

export interface ScoreConditionStats {
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

function sorted(values: number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

function median(s: number[]): number {
  if (s.length === 0) return 0;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function quartiles(s: number[]): { q1: number; q2: number; q3: number } {
  if (s.length === 0) return { q1: 0, q2: 0, q3: 0 };
  const q2 = median(s);
  const mid = Math.floor(s.length / 2);
  const lower = s.slice(0, mid);
  const upper = s.slice(s.length % 2 === 1 ? mid + 1 : mid);
  return {
    q1: lower.length > 0 ? median(lower) : q2,
    q2,
    q3: upper.length > 0 ? median(upper) : q2,
  };
}

function stdDev(values: number[], mean: number): number {
  if (values.length < 2) return 0;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function computeScoreByCondition(
  sessions: ParsedGameSession[],
  boards: Map<number, RewardSurface>,
): ScoreConditionStats[] {
  const grouped = sessions.reduce<Partial<Record<AI_Type, number[]>>>((acc, s) => {
    (acc[s.ai_advice] ??= []).push(computeSessionScore(s, boards).avg);
    return acc;
  }, {});

  return (Object.values(AI_Type).filter((v) => typeof v === "number") as AI_Type[]).map((type) => {
    const scores = grouped[type] ?? [];
    if (scores.length === 0) {
      return { aiType: type, label: AI_TYPE_LABELS[type], color: AI_TYPE_COLORS[type], count: 0, mean: 0, stdDev: 0, ci95: 0, median: 0, q1: 0, q3: 0, min: 0, max: 0 };
    }
    const s = sorted(scores);
    const mean = s.reduce((sum, v) => sum + v, 0) / s.length;
    const sd = stdDev(s, mean);
    const ci95 = s.length > 1 ? (1.96 * sd) / Math.sqrt(s.length) : 0;
    const { q1, q2, q3 } = quartiles(s);
    return {
      aiType: type,
      label: AI_TYPE_LABELS[type],
      color: AI_TYPE_COLORS[type],
      count: s.length,
      mean,
      stdDev: sd,
      ci95,
      median: q2,
      q1,
      q3,
      min: s[0],
      max: s[s.length - 1],
    };
  });
}

export interface ScoreSkillPoint {
  score: number;
  executionSkill: number;
  aiType: AI_Type;
  label: string;
  color: string;
  user_uuid: string;
  sessionIndex: number;
}

export function computeScoreVsSkillPoints(
  sessions: ParsedGameSession[],
  boards: Map<number, RewardSurface>,
): ScoreSkillPoint[] {
  return sessions.map((s, i) => ({
    score: computeSessionScore(s, boards).avg,
    executionSkill: s.execution_skill,
    aiType: s.ai_advice,
    label: AI_TYPE_LABELS[s.ai_advice],
    color: AI_TYPE_COLORS[s.ai_advice],
    user_uuid: s.user_uuid,
    sessionIndex: i,
  }));
}

export function computeGameProximity(game: DartGameDTO): number | null {
  if (!game.suggested_aiming_coord) return null;
  const dx = game.actual_aiming_coord.x - game.suggested_aiming_coord.x;
  const dy = game.actual_aiming_coord.y - game.suggested_aiming_coord.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function computeGameDurationSecs(game: DartGameDTO): number {
  return Math.max(0, (game.end - game.start) / 1000);
}

export interface ProximityScorePoint {
  avgProximity: number | null;
  score: number;
  aiType: AI_Type;
  label: string;
  color: string;
  session: ParsedGameSession;
}

export function computeProximityVsScorePoints(
  sessions: ParsedGameSession[],
  boards: Map<number, RewardSurface>,
): ProximityScorePoint[] {
  return sessions.map((session) => {
    const proximities = session.games
      .map(computeGameProximity)
      .filter((p): p is number => p !== null);
    const avgProximity =
      proximities.length > 0
        ? proximities.reduce((s, v) => s + v, 0) / proximities.length
        : null;
    return {
      avgProximity,
      score: computeSessionScore(session, boards).avg,
      aiType: session.ai_advice,
      label: AI_TYPE_LABELS[session.ai_advice],
      color: AI_TYPE_COLORS[session.ai_advice],
      session,
    };
  });
}
