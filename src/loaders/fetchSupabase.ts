import type { ParsedGameSession, ParsedSurveyResponse } from "./loadData";
import type { DartGameDTO, AI_Type } from "../types/dart";
import type { Answer } from "../types/survey";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL);
}

export interface FetchedData {
  sessions: ParsedGameSession[];
  survey: ParsedSurveyResponse[];
}

interface ApiGameSessionRow {
  id: string;
  created_at: string;
  user_uuid: string;
  user_nickname: string | null;
  execution_skill: number;
  games_played: number;
  ai_advice: number;
  games: DartGameDTO[] | string;
}

interface ApiSurveyRow {
  id: string;
  created_at: string;
  user_uuid: string;
  user_nickname: string | null;
  responses: Answer[] | string;
}

function coerceArray<T>(value: T[] | string, fallback: T[]): T[] {
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(value) as T[];
  } catch {
    return fallback;
  }
}

export async function fetchData(password: string): Promise<FetchedData> {
  if (!SUPABASE_URL) {
    throw new Error("VITE_SUPABASE_URL is not configured.");
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/fetch-data`, {
    method: "POST",
    headers: { "x-fetch-password": password },
  });

  if (res.status === 401) {
    throw new Error("Incorrect password.");
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Fetch failed (${res.status}): ${body}`);
  }

  const { sessions: rawSessions, survey: rawSurvey } = (await res.json()) as {
    sessions: ApiGameSessionRow[];
    survey: ApiSurveyRow[];
  };

  return {
    sessions: rawSessions.map((row) => ({
      id: row.id,
      created_at: row.created_at,
      user_uuid: row.user_uuid,
      user_nickname: row.user_nickname ?? null,
      execution_skill: Number(row.execution_skill),
      games_played: Number(row.games_played),
      ai_advice: Number(row.ai_advice) as AI_Type,
      games: coerceArray<DartGameDTO>(row.games, []),
    })),
    survey: rawSurvey.map((row) => ({
      id: row.id,
      created_at: row.created_at,
      user_uuid: row.user_uuid,
      user_nickname: row.user_nickname ?? null,
      responses: coerceArray<Answer>(row.responses, []),
    })),
  };
}
