/**
 * Raw row shapes as exported from Supabase to CSV.
 * JSON columns (games, responses) arrive as serialized strings and must be parsed.
 */

import { AI_Type } from "./dart";

export interface GameSessionRow {
  id: string;
  created_at: string;
  user_uuid: string;
  user_nickname: string | null;
  execution_skill: number;
  games_played: number;
  ai_advice: AI_Type;
  games: string; // JSON-serialized DartGameDTO[]
}

export interface SurveyResponseRow {
  id: string;
  created_at: string;
  user_uuid: string;
  user_nickname: string | null;
  responses: string; // JSON-serialized Answer[]
}
