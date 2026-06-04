import { AI_Type } from "../types/dart";
import type { DartGameDTO, RewardSurface } from "../types/dart";
import type { ParsedGameSession } from "../loaders/loadData";
import { AI_TYPE_COLORS, AI_TYPE_LABELS } from "./stats";
import { getOptimalAimingCoord } from "./aimingLookup";
import { getAimEV } from "./aimingEV";

export function gameScore(game: DartGameDTO, surface: RewardSurface): number {
  return game.hits.reduce((sum, hit) => {
    const x = Math.floor(hit.x);
    const y = Math.floor(hit.y);
    return sum + (surface[x]?.[y] ?? 0);
  }, 0);
}

/**
 * Game score normalized by hit count. Hit count is now dynamic per game
 * (typically 1/3/5/10 throws at one aim), so raw summed score is confounded by
 * how many throws a game allowed. This per-hit value is the canonical score for
 * charting/correlation; raw {@link gameScore} is kept for Raw Data / back-compat.
 */
export function gameScorePerHit(game: DartGameDTO, surface: RewardSurface): number {
  return gameScore(game, surface) / Math.max(1, game.hits.length);
}

/** Mean per-hit score across all games in a session. */
export function computeSessionScorePerHit(
  session: ParsedGameSession,
  boards: Map<number, RewardSurface>,
): number {
  if (session.games.length === 0) return 0;
  const perHit = session.games.map((game) => {
    const surface = boards.get(game.board_id);
    return surface ? gameScorePerHit(game, surface) : 0;
  });
  return perHit.reduce((s, v) => s + v, 0) / perHit.length;
}

/**
 * Total session score divided by total hit count across all games — a true
 * hit-weighted per-hit score (sum of every hit's surface value ÷ number of
 * hits). This differs from {@link computeSessionScorePerHit}, which averages
 * each game's per-hit ratio equally regardless of how many hits that game had.
 */
export function computeSessionScoreTotalPerHit(
  session: ParsedGameSession,
  boards: Map<number, RewardSurface>,
): number {
  let totalScore = 0;
  let totalHits = 0;
  for (const game of session.games) {
    const surface = boards.get(game.board_id);
    if (surface) totalScore += gameScore(game, surface);
    totalHits += game.hits.length;
  }
  return totalHits > 0 ? totalScore / totalHits : 0;
}

export interface Dispersion {
  mean: number;
  std: number;
}

/**
 * Spread of a game's hits around its actual aim point: mean and sample std of
 * the Euclidean distance from each hit to `actual_aiming_coord`. With dynamic
 * hit counts this captures how tightly repeated throws cluster around the aim.
 */
export function computeGameHitDispersion(game: DartGameDTO): Dispersion {
  const dists = game.hits.map((hit) => {
    const dx = hit.x - game.actual_aiming_coord.x;
    const dy = hit.y - game.actual_aiming_coord.y;
    return Math.sqrt(dx * dx + dy * dy);
  });
  if (dists.length === 0) return { mean: 0, std: 0 };
  const mean = dists.reduce((s, v) => s + v, 0) / dists.length;
  return { mean, std: stdDev(dists, mean) };
}

/** Mean over a session's games of per-game hit-dispersion mean and std. */
export function computeSessionHitDispersion(session: ParsedGameSession): Dispersion {
  if (session.games.length === 0) return { mean: 0, std: 0 };
  const per = session.games.map(computeGameHitDispersion);
  const mean = per.reduce((s, d) => s + d.mean, 0) / per.length;
  const std = per.reduce((s, d) => s + d.std, 0) / per.length;
  return { mean, std };
}

/**
 * Per-hit gap between realized score and expected value:
 * `gameScorePerHit − getAimEV(...)`. EV is a placeholder until the EV JSON
 * lands (see aimingEV.ts), so every gap is currently `scorePerHit − 8`.
 */
export function computeGameEvGap(
  game: DartGameDTO,
  surface: RewardSurface,
  executionSkill: number,
): number {
  return (
    gameScorePerHit(game, surface) -
    getAimEV(game.board_id, game.actual_aiming_coord, executionSkill)
  );
}

/** Mean per-hit EV gap across all games in a session. */
export function computeSessionEvGap(
  session: ParsedGameSession,
  boards: Map<number, RewardSurface>,
): number {
  if (session.games.length === 0) return 0;
  const gaps = session.games.map((game) => {
    const surface = boards.get(game.board_id);
    const perHit = surface ? gameScorePerHit(game, surface) : 0;
    return perHit - getAimEV(game.board_id, game.actual_aiming_coord, session.execution_skill);
  });
  return gaps.reduce((s, v) => s + v, 0) / gaps.length;
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
  sessionIndex: number;
}

export function computeGameOptimalProximity(
  game: DartGameDTO,
  executionSkill: number,
): number | null {
  const optimal = getOptimalAimingCoord(game.board_id, executionSkill);
  if (!optimal) return null;
  const dx = game.actual_aiming_coord.x - optimal.x;
  const dy = game.actual_aiming_coord.y - optimal.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export interface OptimalProximityScorePoint {
  avgProximity: number | null;
  score: number;
  aiType: AI_Type;
  label: string;
  color: string;
  session: ParsedGameSession;
  sessionIndex: number;
}

export function computeOptimalProximityVsScorePoints(
  sessions: ParsedGameSession[],
  boards: Map<number, RewardSurface>,
): OptimalProximityScorePoint[] {
  return sessions.map((session, i) => {
    const proximities = session.games
      .map((g) => computeGameOptimalProximity(g, session.execution_skill))
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
      sessionIndex: i,
    };
  });
}

export function computeProximityVsScorePoints(
  sessions: ParsedGameSession[],
  boards: Map<number, RewardSurface>,
): ProximityScorePoint[] {
  return sessions.map((session, i) => {
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
      sessionIndex: i,
    };
  });
}
