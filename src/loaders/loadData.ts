import Papa from "papaparse";
import { AI_Type } from "../types/dart";
import type { DartGameDTO, Game_SessionDTO } from "../types/dart";
import type { Answer, PostSessionSurveyResponseDTO } from "../types/survey";
import type { GameSessionRow, SurveyResponseRow } from "../types/db";

export interface ParsedGameSession extends Game_SessionDTO {
  id: string;
  created_at: string;
  user_uuid: string;
}

export interface ParsedSurveyResponse extends PostSessionSurveyResponseDTO {
  id: string;
  created_at: string;
}

function parseCSV<T>(csv: string): T[] {
  const result = Papa.parse<T>(csv, { header: true, skipEmptyLines: true });
  return result.data;
}

export async function loadGameSessions(csv: string): Promise<ParsedGameSession[]> {
  const rows = parseCSV<GameSessionRow>(csv);
  return rows.map((row) => ({
    id: row.id,
    created_at: row.created_at,
    user_uuid: row.user_uuid,
    user_nickname: row.user_nickname || null,
    execution_skill: Number(row.execution_skill),
    games_played: Number(row.games_played),
    ai_advice: Number(row.ai_advice) as AI_Type,
    games: safeParseJSON<DartGameDTO[]>(row.games, []),
  }));
}

export async function loadSurveyResponses(csv: string): Promise<ParsedSurveyResponse[]> {
  const rows = parseCSV<SurveyResponseRow>(csv);
  return rows.map((row) => ({
    id: row.id,
    created_at: row.created_at,
    user_uuid: row.user_uuid,
    user_nickname: row.user_nickname,
    responses: safeParseJSON<Answer[]>(row.responses, []),
  }));
}

export function safeParseJSON<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
