import type { ParsedGameSession } from "../loaders/loadData";
import type { JoinedSessionSurvey } from "./surveyStats";
import { getAnswerValue } from "./surveyStats";
import { computeSessionScore, gameScore } from "./scoreStats";
import { AI_TYPE_COLORS, AI_TYPE_LABELS } from "./stats";
import { AI_Type } from "../types/dart";
import type { RewardSurface } from "../types/dart";

export interface ParticipantEntry {
  uuid: string;
  nickname: string;
}

export function getParticipantList(sessions: ParsedGameSession[]): ParticipantEntry[] {
  const map = new Map<string, { nickname: string | null; latestDate: string }>();
  for (const s of sessions) {
    const existing = map.get(s.user_uuid);
    if (!existing || s.created_at > existing.latestDate) {
      map.set(s.user_uuid, { nickname: s.user_nickname, latestDate: s.created_at });
    }
  }
  return Array.from(map.entries())
    .map(([uuid, { nickname }]) => ({ uuid, nickname: nickname ?? uuid }))
    .sort((a, b) => a.nickname.localeCompare(b.nickname));
}

export interface IndividualSessionPoint {
  sessionIndex: number;
  date: string;
  score: number;
  trust: number | null;
  aiType: AI_Type;
  label: string;
  color: string;
  gamesPlayed: number;
}

export function computeIndividualTimeline(
  joined: JoinedSessionSurvey[],
  userId: string,
  trustQuestionId: string,
  boards: Map<number, RewardSurface>,
): IndividualSessionPoint[] {
  return joined
    .filter((j) => j.session.user_uuid === userId)
    .sort((a, b) => a.session.created_at.localeCompare(b.session.created_at))
    .map(({ session, survey }, idx) => ({
      sessionIndex: idx + 1,
      date: session.created_at.slice(0, 10),
      score: computeSessionScore(session, boards).avg,
      trust: survey ? getAnswerValue(survey.responses, trustQuestionId) : null,
      aiType: session.ai_advice,
      label: AI_TYPE_LABELS[session.ai_advice],
      color: AI_TYPE_COLORS[session.ai_advice],
      gamesPlayed: session.games_played,
    }));
}

export interface IndividualKpis {
  sessionsPlayed: number;
  avgScore: number;
  avgTrust: number | null;
  conditionsSeen: string[];
}

export function computeIndividualKpis(
  joined: JoinedSessionSurvey[],
  userId: string,
  trustQuestionId: string,
  boards: Map<number, RewardSurface>,
): IndividualKpis {
  const mine = joined
    .filter((j) => j.session.user_uuid === userId)
    .sort((a, b) => a.session.created_at.localeCompare(b.session.created_at));

  if (mine.length === 0) {
    return { sessionsPlayed: 0, avgScore: 0, avgTrust: null, conditionsSeen: [] };
  }

  const scores = mine.map((j) => computeSessionScore(j.session, boards).avg);
  const avgScore = scores.reduce((s, v) => s + v, 0) / scores.length;

  const trustValues = mine
    .map((j) => j.survey ? getAnswerValue(j.survey.responses, trustQuestionId) : null)
    .filter((v): v is number => v !== null);
  const avgTrust = trustValues.length > 0
    ? trustValues.reduce((s, v) => s + v, 0) / trustValues.length
    : null;

  const seenConditions: string[] = [];
  const seenTypes = new Set<AI_Type>();
  for (const j of mine) {
    if (!seenTypes.has(j.session.ai_advice)) {
      seenTypes.add(j.session.ai_advice);
      seenConditions.push(AI_TYPE_LABELS[j.session.ai_advice]);
    }
  }

  return { sessionsPlayed: mine.length, avgScore, avgTrust, conditionsSeen: seenConditions };
}

export interface GameBreakdownPoint {
  gameIndex: number;
  score: number;
}

export function computeGameBreakdown(
  session: ParsedGameSession,
  boards: Map<number, RewardSurface>,
): GameBreakdownPoint[] {
  return session.games.map((g, i) => {
    const surface = boards.get(g.board_id);
    return {
      gameIndex: i + 1,
      score: surface ? gameScore(g, surface) : 0,
    };
  });
}
