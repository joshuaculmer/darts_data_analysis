// IndexedDB persistence for the uploaded/fetched datasets.
//
// localStorage caps out around 5 MB per origin, which the fetched session data
// (every game's full hits array) now exceeds — persisting there throws
// QuotaExceededError. IndexedDB has effectively no practical limit for this
// dataset and stores structured objects directly, so no JSON.stringify pass is
// needed. Everything stays in the user's browser exactly like localStorage did.
import { get, set, del } from "idb-keyval";
import type {
  ParsedGameSession,
  ParsedSurveyResponse,
} from "../loaders/loadData";

const SESSIONS_KEY = "darts:sessions";
const SURVEY_KEY = "darts:survey";
const SESSIONS_CSV_KEY = "darts:sessions_csv";
const SURVEY_CSV_KEY = "darts:survey_csv";

// Pre-IndexedDB keys; read once for migration, then removed.
const LEGACY_SESSIONS_JSON = "darts:sessions_json";
const LEGACY_SURVEY_JSON = "darts:survey_json";
const LEGACY_SESSIONS_CSV = "darts:sessions_csv";
const LEGACY_SURVEY_CSV = "darts:survey_csv";

export interface PersistedData {
  sessions: ParsedGameSession[] | null;
  survey: ParsedSurveyResponse[] | null;
  sessionsCsv: string | null;
  surveyCsv: string | null;
}

/** Persist a successful Supabase fetch. Supersedes any uploaded CSVs. */
export async function persistFetchedData(
  sessions: ParsedGameSession[],
  survey: ParsedSurveyResponse[],
): Promise<void> {
  await set(SESSIONS_KEY, sessions);
  await set(SURVEY_KEY, survey);
  await del(SESSIONS_CSV_KEY);
  await del(SURVEY_CSV_KEY);
}

/** Persist an uploaded sessions CSV. Supersedes fetched sessions data. */
export async function persistSessionsCsv(text: string): Promise<void> {
  await set(SESSIONS_CSV_KEY, text);
  await del(SESSIONS_KEY);
}

/** Persist an uploaded survey CSV. Supersedes fetched survey data. */
export async function persistSurveyCsv(text: string): Promise<void> {
  await set(SURVEY_CSV_KEY, text);
  await del(SURVEY_KEY);
}

function legacyRead(key: string): string | null {
  if (typeof localStorage === "undefined") return null;
  const value = localStorage.getItem(key);
  if (value !== null) localStorage.removeItem(key);
  return value;
}

function legacyParse<T>(json: string | null): T | null {
  if (json === null) return null;
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

/**
 * Restore whatever is persisted. IndexedDB wins; any data still sitting under
 * the old localStorage keys is migrated into IndexedDB and removed, freeing
 * the origin's localStorage quota.
 */
export async function restorePersistedData(): Promise<PersistedData> {
  let sessions = (await get<ParsedGameSession[]>(SESSIONS_KEY)) ?? null;
  let survey = (await get<ParsedSurveyResponse[]>(SURVEY_KEY)) ?? null;
  let sessionsCsv = (await get<string>(SESSIONS_CSV_KEY)) ?? null;
  let surveyCsv = (await get<string>(SURVEY_CSV_KEY)) ?? null;

  if (sessions === null && sessionsCsv === null) {
    sessions = legacyParse<ParsedGameSession[]>(legacyRead(LEGACY_SESSIONS_JSON));
    if (sessions !== null) {
      await set(SESSIONS_KEY, sessions);
    } else {
      sessionsCsv = legacyRead(LEGACY_SESSIONS_CSV);
      if (sessionsCsv !== null) await set(SESSIONS_CSV_KEY, sessionsCsv);
    }
  }

  if (survey === null && surveyCsv === null) {
    survey = legacyParse<ParsedSurveyResponse[]>(legacyRead(LEGACY_SURVEY_JSON));
    if (survey !== null) {
      await set(SURVEY_KEY, survey);
    } else {
      surveyCsv = legacyRead(LEGACY_SURVEY_CSV);
      if (surveyCsv !== null) await set(SURVEY_CSV_KEY, surveyCsv);
    }
  }

  return { sessions, survey, sessionsCsv, surveyCsv };
}

/** Remove all persisted data (Clear Data button), including legacy keys. */
export async function clearPersistedData(): Promise<void> {
  await del(SESSIONS_KEY);
  await del(SURVEY_KEY);
  await del(SESSIONS_CSV_KEY);
  await del(SURVEY_CSV_KEY);
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(LEGACY_SESSIONS_JSON);
    localStorage.removeItem(LEGACY_SURVEY_JSON);
    localStorage.removeItem(LEGACY_SESSIONS_CSV);
    localStorage.removeItem(LEGACY_SURVEY_CSV);
  }
}
