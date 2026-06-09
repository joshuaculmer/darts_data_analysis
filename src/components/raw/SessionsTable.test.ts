import { describe, it, expect } from "vitest";
import { AI_Type } from "../../types/dart";
import type { DartGameDTO, RewardSurface } from "../../types/dart";
import type { ParsedGameSession, ParsedSurveyResponse } from "../../loaders/loadData";
import { buildSessionTableRows } from "./SessionsTable";
import { evGridKey, EV_GRID_SIZE } from "../../loaders/loadEvGrids";

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

function makeSurvey(
  responses: { questionId: string; value: number | string }[],
): ParsedSurveyResponse {
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

describe("buildSessionTableRows", () => {
  it("returns one row per session, preserving order", () => {
    const rows = buildSessionTableRows(
      [makeSession({ user_uuid: "a" }), makeSession({ user_uuid: "b" })],
      [],
      new Map(),
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].uuid).toBe("a");
    expect(rows[1].uuid).toBe("b");
  });

  it("computes extrapolated score columns from games and boards", () => {
    const boards = new Map([[0, makeFlatSurface(10)]]);
    // two games: one with 2 hits (score 20), one with 1 hit (score 10)
    const session = makeSession({
      games: [
        makeGame({ hits: [{ x: 0, y: 0 }, { x: 0, y: 0 }] }),
        makeGame({ hits: [{ x: 0, y: 0 }] }),
      ],
    });
    // Grids store EV for a 10-hit game: 80 → per-hit EV 8.
    const evGrids = new Map([
      [evGridKey(0, 50), new Float32Array(EV_GRID_SIZE * EV_GRID_SIZE).fill(80)],
    ]);
    const r = buildSessionTableRows([session], [], boards, evGrids)[0];
    expect(r.totalScore).toBeCloseTo(30); // 20 + 10
    expect(r.avgHitCount).toBeCloseTo(1.5); // (2 + 1) / 2 games
    expect(r.scorePerHit).toBeCloseTo(10); // mean per-game per-hit ratio (10 & 10)
    expect(r.evGap).toBeCloseTo(2); // 10 - EV 8 at the actual aim
    expect(r.dispersionMean).toBeCloseTo(0); // all hits at the aim point
    expect(r.dispersionStd).toBeCloseTo(0);
  });

  it("joins the nearest survey and exposes its dimensions", () => {
    const survey = makeSurvey([
      { questionId: "trust", value: "Agree" }, // → 4
      { questionId: "influence", value: 2 },
      { questionId: "satisfied", value: "Strongly Agree" }, // → 5
      { questionId: "luck", value: "Very Lucky" }, // → 5
    ]);
    const r = buildSessionTableRows([makeSession()], [survey], new Map())[0];
    expect(r.trust).toBe(4);
    expect(r.influence).toBe(2);
    expect(r.satisfied).toBe(5);
    expect(r.luck).toBe(5);
  });

  it("leaves extrapolated + survey columns null when data is absent", () => {
    const r = buildSessionTableRows([makeSession({ games: [] })], [], new Map())[0];
    expect(r.scorePerHit).toBeNull();
    expect(r.proxAI).toBeNull();
    expect(r.proxOptimal).toBeNull();
    expect(r.dispersionMean).toBeNull();
    expect(r.dispersionStd).toBeNull();
    expect(r.evGap).toBeNull();
    expect(r.trust).toBeNull();
    expect(r.luck).toBeNull();
    // raw totals still defined (just zero)
    expect(r.totalScore).toBe(0);
    expect(r.avgHitCount).toBe(0);
  });
});
