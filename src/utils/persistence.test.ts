import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import {
  persistFetchedData,
  persistSessionsCsv,
  persistSurveyCsv,
  restorePersistedData,
  clearPersistedData,
} from "./persistence";
import type {
  ParsedGameSession,
  ParsedSurveyResponse,
} from "../loaders/loadData";
import { AI_Type } from "../types/dart";

// Minimal in-memory localStorage stub — node has none; only the legacy
// migration path touches it.
function makeLocalStorageStub() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

const sampleSessions: ParsedGameSession[] = [
  {
    id: "s1",
    created_at: "2026-01-02T03:04:05Z",
    user_uuid: "u1",
    user_nickname: "nick",
    execution_skill: 10,
    games_played: 3,
    ai_advice: AI_Type.CORRECT,
    games: [
      {
        board_id: 5,
        hits: [{ x: 1.5, y: 2.5 }],
        suggested_aiming_coord: { x: 3, y: 4 },
        actual_aiming_coord: { x: 1, y: 2 },
        start: 1000,
        end: 2000,
      },
    ],
  },
];

const sampleSurvey: ParsedSurveyResponse[] = [
  {
    id: "r1",
    created_at: "2026-01-02T03:05:00Z",
    user_uuid: "u1",
    user_nickname: "nick",
    responses: [{ questionId: "q_trust", value: "Agree" }],
  },
];

beforeEach(async () => {
  globalThis.localStorage = makeLocalStorageStub();
  await clearPersistedData();
});

describe("persistence (IndexedDB)", () => {
  it("returns all nulls when nothing is persisted", async () => {
    const restored = await restorePersistedData();
    expect(restored).toEqual({
      sessions: null,
      survey: null,
      sessionsCsv: null,
      surveyCsv: null,
    });
  });

  it("round-trips fetched data as structured objects", async () => {
    await persistFetchedData(sampleSessions, sampleSurvey);
    const restored = await restorePersistedData();
    expect(restored.sessions).toEqual(sampleSessions);
    expect(restored.survey).toEqual(sampleSurvey);
    expect(restored.sessionsCsv).toBeNull();
    expect(restored.surveyCsv).toBeNull();
  });

  it("round-trips uploaded CSV text", async () => {
    await persistSessionsCsv("id,user_uuid\ns1,u1");
    await persistSurveyCsv("id,responses\nr1,[]");
    const restored = await restorePersistedData();
    expect(restored.sessionsCsv).toBe("id,user_uuid\ns1,u1");
    expect(restored.surveyCsv).toBe("id,responses\nr1,[]");
    expect(restored.sessions).toBeNull();
    expect(restored.survey).toBeNull();
  });

  it("persisting fetched data supersedes previously uploaded CSVs", async () => {
    await persistSessionsCsv("old,csv");
    await persistSurveyCsv("old,csv");
    await persistFetchedData(sampleSessions, sampleSurvey);
    const restored = await restorePersistedData();
    expect(restored.sessions).toEqual(sampleSessions);
    expect(restored.sessionsCsv).toBeNull();
    expect(restored.surveyCsv).toBeNull();
  });

  it("uploading a CSV supersedes previously fetched data for that table only", async () => {
    await persistFetchedData(sampleSessions, sampleSurvey);
    await persistSessionsCsv("new,sessions,csv");
    const restored = await restorePersistedData();
    expect(restored.sessions).toBeNull();
    expect(restored.sessionsCsv).toBe("new,sessions,csv");
    // survey side untouched
    expect(restored.survey).toEqual(sampleSurvey);
    expect(restored.surveyCsv).toBeNull();
  });

  it("clearPersistedData removes everything", async () => {
    await persistFetchedData(sampleSessions, sampleSurvey);
    await persistSessionsCsv("a,b");
    await clearPersistedData();
    const restored = await restorePersistedData();
    expect(restored).toEqual({
      sessions: null,
      survey: null,
      sessionsCsv: null,
      surveyCsv: null,
    });
  });
});

describe("legacy localStorage migration", () => {
  it("migrates old JSON keys into IndexedDB and removes them", async () => {
    localStorage.setItem("darts:sessions_json", JSON.stringify(sampleSessions));
    localStorage.setItem("darts:survey_json", JSON.stringify(sampleSurvey));

    const restored = await restorePersistedData();
    expect(restored.sessions).toEqual(sampleSessions);
    expect(restored.survey).toEqual(sampleSurvey);

    // legacy keys are gone…
    expect(localStorage.getItem("darts:sessions_json")).toBeNull();
    expect(localStorage.getItem("darts:survey_json")).toBeNull();

    // …and the data now lives in IndexedDB
    const again = await restorePersistedData();
    expect(again.sessions).toEqual(sampleSessions);
    expect(again.survey).toEqual(sampleSurvey);
  });

  it("migrates old CSV keys into IndexedDB and removes them", async () => {
    localStorage.setItem("darts:sessions_csv", "legacy,sessions");
    localStorage.setItem("darts:survey_csv", "legacy,survey");

    const restored = await restorePersistedData();
    expect(restored.sessionsCsv).toBe("legacy,sessions");
    expect(restored.surveyCsv).toBe("legacy,survey");
    expect(localStorage.getItem("darts:sessions_csv")).toBeNull();
    expect(localStorage.getItem("darts:survey_csv")).toBeNull();

    const again = await restorePersistedData();
    expect(again.sessionsCsv).toBe("legacy,sessions");
    expect(again.surveyCsv).toBe("legacy,survey");
  });

  it("ignores corrupt legacy JSON instead of throwing", async () => {
    localStorage.setItem("darts:sessions_json", "{not json");
    const restored = await restorePersistedData();
    expect(restored.sessions).toBeNull();
    expect(localStorage.getItem("darts:sessions_json")).toBeNull();
  });

  it("IndexedDB data wins over legacy localStorage keys", async () => {
    await persistFetchedData(sampleSessions, sampleSurvey);
    localStorage.setItem(
      "darts:sessions_json",
      JSON.stringify([{ ...sampleSessions[0], id: "stale" }]),
    );
    const restored = await restorePersistedData();
    expect(restored.sessions).toEqual(sampleSessions);
  });

  it("clearPersistedData also removes legacy localStorage keys", async () => {
    localStorage.setItem("darts:sessions_csv", "x");
    localStorage.setItem("darts:sessions_json", "[]");
    await clearPersistedData();
    expect(localStorage.getItem("darts:sessions_csv")).toBeNull();
    expect(localStorage.getItem("darts:sessions_json")).toBeNull();
  });
});
