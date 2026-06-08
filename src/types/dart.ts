export type RewardSurface = number[][];

export interface Coord {
  x: number;
  y: number;
}

export interface DartGameDTO {
  board_id: number;
  seed?: number | null;
  board_seed?: number | null;
  boardSeed?: number | null;
  start: number;
  end: number;
  suggested_aiming_coord: Coord | null;
  actual_aiming_coord: Coord;
  hits: Coord[];
}

export const AI_Type = {
  NONE: 0,
  CORRECT: 1,
  PLAUSIBLE: 2,
  RANDOM: 3,
  WRONG: 4,
  BAD: 5,
  GOOD_PLAUSIBLE: 6,
  PLAUSIBLE_GOOD: 7,
} as const;
export type AI_Type = typeof AI_Type[keyof typeof AI_Type];

export interface Game_SessionDTO {
  execution_skill: number;
  games_played: number;
  ai_advice: AI_Type;
  games: DartGameDTO[];
  user_nickname: string | null;
}
