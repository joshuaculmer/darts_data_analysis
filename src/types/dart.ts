export interface Coord {
  x: number;
  y: number;
}

export interface DartGameDTO {
  board_id: number;
  start: number;
  end: number;
  suggested_aiming_coord: Coord | null;
  actual_aiming_coord: Coord;
  hits: Coord[];
}

export const AI_Type = {
  NONE: 0,
  CORRECT: 1,
  RANDOM: 2,
  WRONG: 3,
  BAD: 4,
  GOOD_BAD: 5,
  BAD_GOOD: 6,
} as const;
export type AI_Type = typeof AI_Type[keyof typeof AI_Type];

export interface Game_SessionDTO {
  execution_skill: number;
  games_played: number;
  ai_advice: AI_Type;
  games: DartGameDTO[];
  user_nickname: string | null;
}
