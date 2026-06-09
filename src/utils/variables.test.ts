import { describe, it, expect } from "vitest";
import { AI_Type } from "../types/dart";
import type { DartGameDTO, RewardSurface } from "../types/dart";
import type { ParsedGameSession, ParsedSurveyResponse } from "../loaders/loadData";
import type { JoinedSessionSurvey } from "./surveyStats";
import {
  buildSessionVariableRows,
  computeVariableByCondition,
  VARIABLES,
  VARIABLE_KEYS,
} from "./variables";
import type { SessionVariableRow } from "./variables";
import { getOptimalAimingCoord } from "./aimingLookup";
import { evGridKey, EV_GRID_SIZE } from "../loaders/loadEvGrids";
import type { EvGrids } from "../loaders/loadEvGrids";

function makeGame(overrides: Partial<DartGameDTO> = {}): DartGameDTO {
  return {
    board_id: 0,
    start: 0,
    end: 0,
    suggested_aiming_coord: null,
    actual_aiming_coord: { x: 0, y: 0 },
    hits: [],
    ...overrides,
  };
}

function makeSession(overrides: Partial<ParsedGameSession> = {}): ParsedGameSession {
  return {
    id: "session-1",
    created_at: "2024-01-15T10:00:00Z",
    user_uuid: "uuid-a",
    user_nickname: "Alice",
    execution_skill: 50,
    games_played: 0,
    ai_advice: AI_Type.NONE,
    games: [],
    ...overrides,
  };
}

function makeSurvey(responses: { questionId: string; value: number | string }[]): ParsedSurveyResponse {
  return {
    id: "survey-1",
    created_at: "2024-01-15T10:30:00Z",
    user_uuid: "uuid-a",
    user_nickname: "Alice",
    responses,
  };
}

function makeFlatSurface(value: number, size = 512): RewardSurface {
  return Array.from({ length: size }, () => Array(size).fill(value));
}

// Grids store EV for a 10-hit game, so fill with perHitEv × 10.
function makeFlatEvGrids(boardId: number, skill: number, perHitEv: number): EvGrids {
  return new Map([
    [evGridKey(boardId, skill), new Float32Array(EV_GRID_SIZE * EV_GRID_SIZE).fill(perHitEv * 10)],
  ]);
}

// ---------------------------------------------------------------------------
// VARIABLES registry
// ---------------------------------------------------------------------------
describe("VARIABLES registry", () => {
  it("defines all 9 unified variables", () => {
    expect(VARIABLE_KEYS).toHaveLength(9);
    expect(new Set(VARIABLE_KEYS)).toEqual(
      new Set([
        "trust",
        "influence",
        "proxAI",
        "satisfied",
        "scorePerHit",
        "proxOptimal",
        "luck",
        "dispersion",
        "evGap",
      ]),
    );
  });

  it("groups variables into trust / performance / luck", () => {
    const group = (k: string) => VARIABLES[k as keyof typeof VARIABLES].group;
    expect(group("trust")).toBe("trust");
    expect(group("influence")).toBe("trust");
    expect(group("proxAI")).toBe("trust");
    expect(group("satisfied")).toBe("performance");
    expect(group("scorePerHit")).toBe("performance");
    expect(group("proxOptimal")).toBe("performance");
    expect(group("luck")).toBe("luck");
    expect(group("dispersion")).toBe("luck");
    expect(group("evGap")).toBe("luck");
  });

  it("each variable has an accessor that reads its row field", () => {
    const row = buildSessionVariableRows(
      [{ session: makeSession(), survey: makeSurvey([{ questionId: "trust", value: 4 }]) }],
      new Map(),
    )[0];
    expect(VARIABLES.trust.accessor(row)).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// buildSessionVariableRows
// ---------------------------------------------------------------------------
describe("buildSessionVariableRows", () => {
  it("returns one row per joined session, carrying nav fields", () => {
    const joined: JoinedSessionSurvey[] = [
      { session: makeSession({ user_uuid: "uuid-a", ai_advice: AI_Type.CORRECT }), survey: null },
      { session: makeSession({ user_uuid: "uuid-b" }), survey: null },
    ];
    const rows = buildSessionVariableRows(joined, new Map());
    expect(rows).toHaveLength(2);
    expect(rows[0].user_uuid).toBe("uuid-a");
    expect(rows[0].ai_advice).toBe(AI_Type.CORRECT);
    expect(rows[0].sessionIndex).toBe(0);
    expect(rows[1].sessionIndex).toBe(1);
  });

  it("sets all survey variables to null when there is no matching survey", () => {
    const rows = buildSessionVariableRows([{ session: makeSession(), survey: null }], new Map());
    expect(rows[0].trust).toBeNull();
    expect(rows[0].influence).toBeNull();
    expect(rows[0].satisfied).toBeNull();
    expect(rows[0].luck).toBeNull();
  });

  it("reads survey dimensions by questionId, including ordinal luck labels", () => {
    const survey = makeSurvey([
      { questionId: "trust", value: "Agree" }, // → 4
      { questionId: "influence", value: 2 },
      { questionId: "satisfied", value: "Strongly Agree" }, // → 5
      { questionId: "luck", value: "Very Lucky" }, // → 5
    ]);
    const rows = buildSessionVariableRows([{ session: makeSession(), survey }], new Map());
    expect(rows[0].trust).toBe(4);
    expect(rows[0].influence).toBe(2);
    expect(rows[0].satisfied).toBe(5);
    expect(rows[0].luck).toBe(5);
  });

  it("computes scorePerHit, dispersion, and evGap from games", () => {
    const boards = new Map([[0, makeFlatSurface(10)]]);
    const game = makeGame({ board_id: 0, hits: [{ x: 0, y: 0 }, { x: 0, y: 0 }] });
    const rows = buildSessionVariableRows(
      [{ session: makeSession({ games: [game] }), survey: null }],
      boards,
      makeFlatEvGrids(0, 50, 8),
    );
    expect(rows[0].scorePerHit).toBeCloseTo(10); // 20 / 2 hits
    expect(rows[0].dispersion).toBeCloseTo(0); // both hits at the aim point
    expect(rows[0].evGap).toBeCloseTo(2); // 10 - EV 8 at the actual aim
  });

  it("evGap is null when no EV grid covers the session's (board, skill) pair", () => {
    const boards = new Map([[0, makeFlatSurface(10)]]);
    const game = makeGame({ board_id: 0, hits: [{ x: 0, y: 0 }] });
    const rows = buildSessionVariableRows(
      [{ session: makeSession({ games: [game] }), survey: null }],
      boards,
      makeFlatEvGrids(0, 99, 8), // wrong skill → no grid for (0, 50)
    );
    expect(rows[0].evGap).toBeNull();
  });

  it("leaves game-derived metrics null when a session has no games", () => {
    const rows = buildSessionVariableRows([{ session: makeSession({ games: [] }), survey: null }], new Map());
    expect(rows[0].scorePerHit).toBeNull();
    expect(rows[0].dispersion).toBeNull();
    expect(rows[0].evGap).toBeNull();
  });

  it("proxAI is null in the NONE condition (no suggested coord)", () => {
    const game = makeGame({ suggested_aiming_coord: null });
    const rows = buildSessionVariableRows(
      [{ session: makeSession({ ai_advice: AI_Type.NONE, games: [game] }), survey: null }],
      new Map(),
    );
    expect(rows[0].proxAI).toBeNull();
  });

  it("proxAI is the mean distance from actual to suggested aim when present", () => {
    const game = makeGame({
      suggested_aiming_coord: { x: 100, y: 100 },
      actual_aiming_coord: { x: 103, y: 104 }, // 3-4-5 → dist 5
    });
    const rows = buildSessionVariableRows(
      [{ session: makeSession({ ai_advice: AI_Type.CORRECT, games: [game] }), survey: null }],
      new Map(),
    );
    expect(rows[0].proxAI).toBeCloseTo(5);
  });

  it("proxOptimal is the mean distance from actual aim to the optimal coord", () => {
    const optimal = getOptimalAimingCoord(0, 50)!;
    const game = makeGame({
      board_id: 0,
      actual_aiming_coord: { x: optimal.x + 3, y: optimal.y + 4 }, // dist 5
    });
    const rows = buildSessionVariableRows(
      [{ session: makeSession({ execution_skill: 50, games: [game] }), survey: null }],
      new Map(),
    );
    expect(rows[0].proxOptimal).toBeCloseTo(5);
  });
});

// ---------------------------------------------------------------------------
// computeVariableByCondition
// ---------------------------------------------------------------------------
function row(ai_advice: number, value: number | null): SessionVariableRow {
  return {
    user_uuid: "u",
    sessionIndex: 0,
    ai_advice: ai_advice as SessionVariableRow["ai_advice"],
    trust: null,
    influence: null,
    proxAI: null,
    satisfied: null,
    scorePerHit: value,
    proxOptimal: null,
    luck: null,
    dispersion: null,
    evGap: null,
  };
}

describe("computeVariableByCondition", () => {
  it("returns an entry for all 8 conditions, with label and color", () => {
    const result = computeVariableByCondition([], "scorePerHit");
    expect(result).toHaveLength(8);
    expect(result[0].aiType).toBe(AI_Type.NONE);
    expect(result.find((r) => r.aiType === AI_Type.CORRECT)!.color).toBe("#0072B2");
  });

  it("computes mean and count per condition, skipping null values", () => {
    const rows = [
      row(AI_Type.CORRECT, 2),
      row(AI_Type.CORRECT, 4),
      row(AI_Type.CORRECT, null), // dropped
      row(AI_Type.WRONG, 10),
    ];
    const result = computeVariableByCondition(rows, "scorePerHit");
    const correct = result.find((r) => r.aiType === AI_Type.CORRECT)!;
    expect(correct.count).toBe(2);
    expect(correct.mean).toBeCloseTo(3);
    expect(result.find((r) => r.aiType === AI_Type.WRONG)!.mean).toBeCloseTo(10);
  });

  it("reports zero count and a CI of 0 for conditions with no data", () => {
    const result = computeVariableByCondition([row(AI_Type.NONE, 5)], "scorePerHit");
    const wrong = result.find((r) => r.aiType === AI_Type.WRONG)!;
    expect(wrong.count).toBe(0);
    expect(wrong.mean).toBe(0);
    expect(wrong.ci95).toBe(0);
  });

  it("computes a positive 95% CI when a condition has multiple values", () => {
    const rows = [row(AI_Type.BAD, 1), row(AI_Type.BAD, 3), row(AI_Type.BAD, 5)];
    const bad = computeVariableByCondition(rows, "scorePerHit").find((r) => r.aiType === AI_Type.BAD)!;
    expect(bad.count).toBe(3);
    expect(bad.mean).toBeCloseTo(3);
    expect(bad.ci95).toBeGreaterThan(0);
  });
});
