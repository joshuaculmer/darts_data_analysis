/**
 * Weekly darts data analysis script.
 *
 * Usage:
 *   npx tsx reports/analysis/weekly-analysis.ts [/tmp/darts-data.json]
 *
 * Input:
 *   JSON file saved by the fetch step: { sessions: [...], survey: [...] }
 *   Board surfaces are read from public/ at the project root.
 *
 * Output (to stdout):
 *   JSON summary with cohort stats, per-condition variable means±CI95,
 *   Spearman correlation matrix, and Q1.2 trajectory contrast.
 *
 * Exit codes:
 *   0 — success
 *   1 — input file missing or unparseable
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Types mirrored from src/ (keep in sync with the TypeScript source)
// ---------------------------------------------------------------------------

interface Coord {
  x: number;
  y: number;
}

interface DartGameDTO {
  board_id: number;
  actual_aiming_coord: Coord;
  suggested_aiming_coord: Coord | null;
  hits: Coord[];
  start: number;
  end: number;
}

interface ParsedGameSession {
  id: string;
  created_at: string;
  user_uuid: string;
  execution_skill: number;
  games_played: number;
  ai_advice: number; // AI_Type 0–6
  games: DartGameDTO[];
}

interface Answer {
  questionId: string;
  value: number | string;
}

interface ParsedSurveyResponse {
  id: string;
  created_at: string;
  user_uuid: string;
  responses: Answer[];
}

type RewardSurface = number[][];

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_SESSIONS_REQUIRED = 20;
const PROJECT_ROOT = path.resolve(__dirname, "../..");

const AI_TYPE_LABELS: Record<number, string> = {
  0: "NONE",
  1: "CORRECT",
  2: "PLAUSIBLE",
  3: "RANDOM",
  4: "WRONG",
  5: "BAD",
  6: "GOOD_PLAUSIBLE",
  7: "PLAUSIBLE_GOOD",
};

const ORDINAL_SCALES: Record<string, number> = {
  // 5-point agreement (trust/influence/satisfied)
  "strongly disagree": 1,
  "disagree": 2,
  "neutral": 3,
  "neither agree nor disagree": 3,
  "agree": 4,
  "strongly agree": 5,
  // 5-point luck attribution
  "very unlucky": 1,
  "unlucky": 2,
  "little or no impact": 3,
  "lucky": 4,
  "very lucky": 5,
};

// ---------------------------------------------------------------------------
// Board loading
// ---------------------------------------------------------------------------

function boardUrl(boardId: number): string {
  if (boardId >= 0 && boardId <= 99) {
    return path.join(PROJECT_ROOT, "public", "Perlin_Noise_Surfaces.ts", `PerlinNoiseBoard${boardId}.json`);
  }
  if (boardId >= 100 && boardId <= 199) {
    return path.join(PROJECT_ROOT, "public", "Gaussian_Sum", `GaussianSumBoard${boardId - 100}.json`);
  }
  throw new Error(`Unknown board_id: ${boardId}`);
}

function loadBoard(boardId: number): RewardSurface | null {
  const p = boardUrl(boardId);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf-8")) as RewardSurface;
}

function loadBoards(sessions: ParsedGameSession[]): Map<number, RewardSurface> {
  const ids = new Set<number>();
  for (const s of sessions) {
    for (const g of s.games) ids.add(g.board_id);
  }
  const map = new Map<number, RewardSurface>();
  for (const id of ids) {
    const surface = loadBoard(id);
    if (surface) map.set(id, surface);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Scoring utilities (mirrors scoreStats.ts definitions)
// ---------------------------------------------------------------------------

function gameScore(game: DartGameDTO, surface: RewardSurface): number {
  return game.hits.reduce((sum, hit) => {
    const x = Math.floor(hit.x);
    const y = Math.floor(hit.y);
    return sum + ((surface[x]?.[y]) ?? 0);
  }, 0);
}

function gameScorePerHit(game: DartGameDTO, surface: RewardSurface): number {
  return gameScore(game, surface) / Math.max(1, game.hits.length);
}

function computeSessionScorePerHit(
  session: ParsedGameSession,
  boards: Map<number, RewardSurface>,
): number {
  if (session.games.length === 0) return 0;
  const perHit = session.games.map((g) => {
    const s = boards.get(g.board_id);
    return s ? gameScorePerHit(g, s) : 0;
  });
  return perHit.reduce((s, v) => s + v, 0) / perHit.length;
}

function computeGameHitDispersionMean(game: DartGameDTO): number {
  const dists = game.hits.map((hit) => {
    const dx = hit.x - game.actual_aiming_coord.x;
    const dy = hit.y - game.actual_aiming_coord.y;
    return Math.sqrt(dx * dx + dy * dy);
  });
  if (dists.length === 0) return 0;
  return dists.reduce((s, v) => s + v, 0) / dists.length;
}

function computeSessionHitDispersion(session: ParsedGameSession): number {
  if (session.games.length === 0) return 0;
  const means = session.games.map(computeGameHitDispersionMean);
  return means.reduce((s, v) => s + v, 0) / means.length;
}

// EV grids (public/ev_grids, written by tools/convert_ev_grids.py): one
// 512×512 uint16 grid per (board_id, execution_skill) pair, [x][y] row-major,
// EV = value * scale. Lazily read and cached per pair.
const EV_GRID_SIZE = 512;
// The grids store EV for a 10-hit game; divide to get per-hit EV.
const EV_GRID_HITS = 10;
let evGridIndex: { scale: number; pairs: Set<string> } | null | undefined;
const evGridCache = new Map<string, Uint16Array | null>();

function getAimEV(
  boardId: number,
  executionSkill: number,
  aim: { x: number; y: number } | null,
): number | null {
  if (!aim) return null;
  if (evGridIndex === undefined) {
    const p = path.join(PROJECT_ROOT, "public", "ev_grids", "index.json");
    if (fs.existsSync(p)) {
      const idx = JSON.parse(fs.readFileSync(p, "utf-8"));
      evGridIndex = {
        scale: idx.scale,
        pairs: new Set(idx.pairs.map(([b, s]: [number, number]) => `${b}:${s}`)),
      };
    } else {
      evGridIndex = null;
    }
  }
  if (!evGridIndex) return null;
  const key = `${boardId}:${executionSkill}`;
  if (!evGridIndex.pairs.has(key)) return null;
  let grid = evGridCache.get(key);
  if (grid === undefined) {
    const p = path.join(PROJECT_ROOT, "public", "ev_grids", `ev_${boardId}_${executionSkill}.bin`);
    grid = fs.existsSync(p)
      ? new Uint16Array(new Uint8Array(fs.readFileSync(p)).buffer)
      : null;
    evGridCache.set(key, grid);
  }
  if (!grid) return null;
  const x = Math.floor(aim.x);
  const y = Math.floor(aim.y);
  if (x < 0 || x >= EV_GRID_SIZE || y < 0 || y >= EV_GRID_SIZE) return null;
  return (grid[x * EV_GRID_SIZE + y] * evGridIndex.scale) / EV_GRID_HITS;
}

/** Mean per-game (scorePerHit − EV of actual aim); null when no game is covered. */
function computeSessionEvGap(
  session: ParsedGameSession,
  boards: Map<number, RewardSurface>,
): number | null {
  const gaps: number[] = [];
  for (const game of session.games) {
    const surface = boards.get(game.board_id);
    if (!surface) continue;
    const ev = getAimEV(game.board_id, session.execution_skill, game.actual_aiming_coord);
    if (ev === null) continue;
    gaps.push(gameScorePerHit(game, surface) - ev);
  }
  if (gaps.length === 0) return null;
  return gaps.reduce((s, v) => s + v, 0) / gaps.length;
}

function computeGameProximity(game: DartGameDTO): number | null {
  if (!game.suggested_aiming_coord) return null;
  const dx = game.actual_aiming_coord.x - game.suggested_aiming_coord.x;
  const dy = game.actual_aiming_coord.y - game.suggested_aiming_coord.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Optimal proximity: distance from actual aim to row-major optimal from aiming JSON.
// Falls back to null if the JSON is missing or skill row is not found.
let perlinAiming: number[][][] | null = null;
let gaussianAiming: number[][][] | null = null;

function loadAimingData() {
  const pa = path.join(PROJECT_ROOT, "src", "data", "Perlin_Aiming.json");
  const ga = path.join(PROJECT_ROOT, "src", "data", "Gaussian_Aiming.json");
  if (fs.existsSync(pa)) perlinAiming = JSON.parse(fs.readFileSync(pa, "utf-8"));
  if (fs.existsSync(ga)) gaussianAiming = JSON.parse(fs.readFileSync(ga, "utf-8"));
}

function getOptimalAimingCoord(boardId: number, executionSkill: number): Coord | null {
  const skillIdx = Math.round((executionSkill - 5) / 5);
  if (boardId >= 0 && boardId <= 99) {
    if (!perlinAiming) return null;
    const row = perlinAiming[boardId]?.[skillIdx];
    if (!row) return null;
    return { x: row[1], y: row[0] }; // [a,b] → x=b, y=a per aimingLookup.ts
  }
  if (boardId >= 100 && boardId <= 199) {
    if (!gaussianAiming) return null;
    const row = gaussianAiming[boardId - 100]?.[skillIdx];
    if (!row) return null;
    return { x: row[1], y: row[0] };
  }
  return null;
}

function computeGameOptimalProximity(game: DartGameDTO, executionSkill: number): number | null {
  const optimal = getOptimalAimingCoord(game.board_id, executionSkill);
  if (!optimal) return null;
  const dx = game.actual_aiming_coord.x - optimal.x;
  const dy = game.actual_aiming_coord.y - optimal.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// ---------------------------------------------------------------------------
// Survey utilities
// ---------------------------------------------------------------------------

function getAnswerValue(responses: Answer[], questionId: string): number | null {
  const answer = responses.find((r) => r.questionId === questionId);
  if (!answer) return null;
  if (typeof answer.value === "number") return answer.value;
  if (typeof answer.value === "string") {
    const t = answer.value.trim();
    const n = Number(t);
    if (!Number.isNaN(n) && t !== "") return n;
    return ORDINAL_SCALES[t.toLowerCase()] ?? null;
  }
  return null;
}

interface JoinedSessionSurvey {
  session: ParsedGameSession;
  survey: ParsedSurveyResponse | null;
}

function joinSessionsWithSurvey(
  sessions: ParsedGameSession[],
  surveys: ParsedSurveyResponse[],
): JoinedSessionSurvey[] {
  return sessions.map((session) => {
    const candidates = surveys.filter((s) => s.user_uuid === session.user_uuid);
    if (candidates.length === 0) return { session, survey: null };
    const sessionTime = new Date(session.created_at).getTime();
    const afterSession = candidates.filter(
      (s) => new Date(s.created_at).getTime() >= sessionTime,
    );
    const pool = afterSession.length > 0 ? afterSession : candidates;
    const nearest = pool.reduce((best, s) => {
      const sDiff = Math.abs(new Date(s.created_at).getTime() - sessionTime);
      const bDiff = Math.abs(new Date(best.created_at).getTime() - sessionTime);
      return sDiff < bDiff ? s : best;
    });
    return { session, survey: nearest };
  });
}

// ---------------------------------------------------------------------------
// Session variable rows
// ---------------------------------------------------------------------------

interface SessionVariableRow {
  user_uuid: string;
  ai_advice: number;
  trust: number | null;
  influence: number | null;
  proxAI: number | null;
  satisfied: number | null;
  scorePerHit: number | null;
  proxOptimal: number | null;
  luck: number | null;
  dispersion: number | null;
  evGap: number | null;
}

function meanOrNull(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) return null;
  return present.reduce((s, v) => s + v, 0) / present.length;
}

function buildSessionVariableRows(
  joined: JoinedSessionSurvey[],
  boards: Map<number, RewardSurface>,
): SessionVariableRow[] {
  return joined.map(({ session, survey }) => {
    const hasGames = session.games.length > 0;
    const proxAI = hasGames ? meanOrNull(session.games.map(computeGameProximity)) : null;
    const proxOptimal = hasGames
      ? meanOrNull(session.games.map((g) => computeGameOptimalProximity(g, session.execution_skill)))
      : null;
    return {
      user_uuid: session.user_uuid,
      ai_advice: session.ai_advice,
      trust: survey ? getAnswerValue(survey.responses, "trust") : null,
      influence: survey ? getAnswerValue(survey.responses, "influence") : null,
      satisfied: survey ? getAnswerValue(survey.responses, "satisfied") : null,
      luck: survey ? getAnswerValue(survey.responses, "luck") : null,
      proxAI,
      proxOptimal,
      scorePerHit: hasGames ? computeSessionScorePerHit(session, boards) : null,
      dispersion: hasGames ? computeSessionHitDispersion(session) : null,
      evGap: hasGames ? computeSessionEvGap(session, boards) : null,
    };
  });
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

function ci95(values: number[]): { mean: number; sd: number; ci: number } {
  if (values.length === 0) return { mean: NaN, sd: NaN, ci: NaN };
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  if (values.length === 1) return { mean, sd: 0, ci: 0 };
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
  const sd = Math.sqrt(variance);
  const ci = (1.96 * sd) / Math.sqrt(values.length);
  return { mean, sd, ci };
}

type VariableKey = keyof Omit<SessionVariableRow, "user_uuid" | "ai_advice">;

const VARIABLE_KEYS: VariableKey[] = [
  "trust", "influence", "proxAI", "satisfied",
  "scorePerHit", "proxOptimal", "luck", "dispersion", "evGap",
];

function computeByCondition(rows: SessionVariableRow[], key: VariableKey) {
  const grouped: Record<number, number[]> = {};
  for (const r of rows) {
    const v = r[key];
    if (v === null || v === undefined) continue;
    (grouped[r.ai_advice] ??= []).push(v as number);
  }
  return Object.fromEntries(
    [0, 1, 2, 3, 4, 5, 6, 7].map((type) => {
      const values = grouped[type] ?? [];
      return [AI_TYPE_LABELS[type], { n: values.length, ...ci95(values) }];
    }),
  );
}

function rank(values: number[]): number[] {
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const ranks = new Array<number>(values.length);
  let k = 0;
  while (k < indexed.length) {
    let j = k;
    while (j + 1 < indexed.length && indexed[j + 1].v === indexed[k].v) j += 1;
    const avgRank = (k + j) / 2 + 1;
    for (let m = k; m <= j; m += 1) ranks[indexed[m].i] = avgRank;
    k = j + 1;
  }
  return ranks;
}

function spearman(xs: (number | null)[], ys: (number | null)[]): { r: number | null; n: number } {
  const px: number[] = [], py: number[] = [];
  const len = Math.min(xs.length, ys.length);
  for (let i = 0; i < len; i++) {
    const a = xs[i], b = ys[i];
    if (a == null || b == null || isNaN(a) || isNaN(b)) continue;
    px.push(a); py.push(b);
  }
  const n = px.length;
  if (n < 2) return { r: null, n };
  const rx = rank(px), ry = rank(py);
  const mx = rx.reduce((s, v) => s + v, 0) / n;
  const my = ry.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = rx[i] - mx, dy = ry[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return { r: null, n };
  return { r: sxy / Math.sqrt(sxx * syy), n };
}

function computeCorrelationMatrix(rows: SessionVariableRow[]) {
  const cols: Record<VariableKey, (number | null)[]> = {} as never;
  for (const key of VARIABLE_KEYS) cols[key] = rows.map((r) => r[key] as number | null);
  const matrix: Record<string, Record<string, { r: number | null; n: number }>> = {};
  for (const ki of VARIABLE_KEYS) {
    matrix[ki] = {};
    for (const kj of VARIABLE_KEYS) {
      matrix[ki][kj] = spearman(cols[ki], cols[kj]);
    }
  }
  return matrix;
}

/** Cohen's d (pooled SD). Returns {d, smd_ci_low, smd_ci_high} using Hedges' g approximation. */
function cohenD(a: number[], b: number[]) {
  if (a.length < 2 || b.length < 2) return { d: null, ci_low: null, ci_high: null };
  const { mean: ma, sd: sa } = ci95(a);
  const { mean: mb, sd: sb } = ci95(b);
  const na = a.length, nb = b.length;
  const pooledVar = ((na - 1) * sa ** 2 + (nb - 1) * sb ** 2) / (na + nb - 2);
  const pooledSd = Math.sqrt(pooledVar);
  if (pooledSd === 0) return { d: 0, ci_low: 0, ci_high: 0 };
  const d = (ma - mb) / pooledSd;
  const se_d = Math.sqrt((na + nb) / (na * nb) + d ** 2 / (2 * (na + nb)));
  return { d, ci_low: d - 1.96 * se_d, ci_high: d + 1.96 * se_d };
}

// ---------------------------------------------------------------------------
// Kruskal–Wallis H test (first-pass test for Q1.1 etc.)
// ---------------------------------------------------------------------------
function kruskalWallis(groups: number[][]): { H: number; df: number } {
  const all = groups.flat();
  const N = all.length;
  if (N === 0) return { H: NaN, df: groups.length - 1 };
  const ranked = rank(all);
  let pos = 0;
  const groupRanks: number[][] = groups.map((g) => {
    const r = ranked.slice(pos, pos + g.length);
    pos += g.length;
    return r;
  });
  const H =
    (12 / (N * (N + 1))) *
      groupRanks.reduce((s, gr) => {
        if (gr.length === 0) return s;
        const mean = gr.reduce((a, v) => a + v, 0) / gr.length;
        return s + gr.length * mean ** 2;
      }, 0) -
    3 * (N + 1);
  return { H, df: groups.length - 1 };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const dataPath = process.argv[2] ?? "/tmp/darts-data.json";

if (!fs.existsSync(dataPath)) {
  console.error(`Data file not found: ${dataPath}`);
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(dataPath, "utf-8")) as {
  sessions: Record<string, unknown>[];
  survey: Record<string, unknown>[];
};

// Map raw API rows to typed objects
function parseSession(row: Record<string, unknown>): ParsedGameSession {
  const games =
    typeof row.games === "string"
      ? (JSON.parse(row.games) as DartGameDTO[])
      : Array.isArray(row.games)
        ? (row.games as DartGameDTO[])
        : [];
  return {
    id: String(row.id ?? ""),
    created_at: String(row.created_at ?? ""),
    user_uuid: String(row.user_uuid ?? ""),
    execution_skill: Number(row.execution_skill ?? 0),
    games_played: Number(row.games_played ?? 0),
    ai_advice: Number(row.ai_advice ?? 0),
    games,
  };
}

function parseSurvey(row: Record<string, unknown>): ParsedSurveyResponse {
  const responses =
    typeof row.responses === "string"
      ? (JSON.parse(row.responses) as Answer[])
      : Array.isArray(row.responses)
        ? (row.responses as Answer[])
        : [];
  return {
    id: String(row.id ?? ""),
    created_at: String(row.created_at ?? ""),
    user_uuid: String(row.user_uuid ?? ""),
    responses,
  };
}

loadAimingData();

const sessions: ParsedGameSession[] = raw.sessions.map(parseSession);
const surveys: ParsedSurveyResponse[] = raw.survey.map(parseSurvey);

// Cohort stats
const uniqueParticipants = new Set(sessions.map((s) => s.user_uuid));
const sessionCountByUser = new Map<string, number>();
const surveyCountByUser = new Map<string, number>();
for (const s of sessions) {
  sessionCountByUser.set(s.user_uuid, (sessionCountByUser.get(s.user_uuid) ?? 0) + 1);
}
for (const sv of surveys) {
  surveyCountByUser.set(sv.user_uuid, (surveyCountByUser.get(sv.user_uuid) ?? 0) + 1);
}
let completeParticipants = 0;
for (const uuid of uniqueParticipants) {
  const sc = sessionCountByUser.get(uuid) ?? 0;
  const svc = surveyCountByUser.get(uuid) ?? 0;
  if (sc === MIN_SESSIONS_REQUIRED && svc === MIN_SESSIONS_REQUIRED) completeParticipants++;
}

const createdAts = sessions.map((s) => s.created_at).sort();
const dateRange = { min: createdAts[0], max: createdAts[createdAts.length - 1] };

// Condition distribution (includes any undocumented ai_advice values as flags)
const conditionSessionCounts: Record<number, number> = {};
for (let i = 0; i < 8; i++) conditionSessionCounts[i] = 0;
for (const s of sessions) conditionSessionCounts[s.ai_advice] = (conditionSessionCounts[s.ai_advice] ?? 0) + 1;

// Board-family balance per condition (handle any ai_advice value, including undocumented ones)
const conditionBoardFamilyCounts: Record<number, { perlin: number; gaussian: number }> = {};
for (let i = 0; i < 8; i++) conditionBoardFamilyCounts[i] = { perlin: 0, gaussian: 0 };
for (const s of sessions) {
  if (!conditionBoardFamilyCounts[s.ai_advice]) conditionBoardFamilyCounts[s.ai_advice] = { perlin: 0, gaussian: 0 };
  for (const g of s.games) {
    if (g.board_id >= 0 && g.board_id <= 99) conditionBoardFamilyCounts[s.ai_advice].perlin++;
    else if (g.board_id >= 100 && g.board_id <= 199) conditionBoardFamilyCounts[s.ai_advice].gaussian++;
  }
}

// Skill balance per condition
const conditionSkills: Record<number, number[]> = {};
for (let i = 0; i < 8; i++) conditionSkills[i] = [];
for (const s of sessions) {
  if (!conditionSkills[s.ai_advice]) conditionSkills[s.ai_advice] = [];
  conditionSkills[s.ai_advice].push(s.execution_skill);
}
const conditionSkillMeans: Record<number, number | null> = {};
for (const aiType of Object.keys(conditionSkills).map(Number)) {
  const arr = conditionSkills[aiType];
  conditionSkillMeans[aiType] = arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
}

// games_played mismatch check
const gamesPlayedMismatches = sessions.filter(
  (s) => s.games_played !== s.games.length && s.games.length > 0,
).length;

// Load boards and build variable rows
const boards = loadBoards(sessions);
const joined = joinSessionsWithSurvey(sessions, surveys);
const varRows = buildSessionVariableRows(joined, boards);

// Variable means±CI95 by condition
const byCondition: Record<string, ReturnType<typeof computeByCondition>> = {};
for (const key of VARIABLE_KEYS) {
  byCondition[key] = computeByCondition(varRows, key);
}

// Spearman correlation matrix
const corrMatrix = computeCorrelationMatrix(varRows);

// Q1.2 trajectory contrast: GOOD_PLAUSIBLE (5) vs PLAUSIBLE_GOOD (6)
// GOOD_PLAUSIBLE=6, PLAUSIBLE_GOOD=7 in the updated enum
const gp = varRows.filter((r) => r.ai_advice === 6).map((r) => r.scorePerHit).filter((v): v is number => v !== null);
const pg = varRows.filter((r) => r.ai_advice === 7).map((r) => r.scorePerHit).filter((v): v is number => v !== null);
const { mean: gp_mean } = ci95(gp);
const { mean: pg_mean } = ci95(pg);
const trajectory = {
  GOOD_PLAUSIBLE: { n: gp.length, mean: gp_mean, ...ci95(gp) },
  PLAUSIBLE_GOOD: { n: pg.length, mean: pg_mean, ...ci95(pg) },
  cohenD: cohenD(gp, pg),
};

// KW test for Q1.1 scorePerHit across 7 conditions
const scoreGroups = [0, 1, 2, 3, 4, 5, 6, 7].map(
  (c) => varRows.filter((r) => r.ai_advice === c).map((r) => r.scorePerHit).filter((v): v is number => v !== null),
);
const kw_score = kruskalWallis(scoreGroups);

// Complete-participant n per condition
const completeUUIDs = new Set<string>();
for (const uuid of uniqueParticipants) {
  const sc = sessionCountByUser.get(uuid) ?? 0;
  const svc = surveyCountByUser.get(uuid) ?? 0;
  if (sc === MIN_SESSIONS_REQUIRED && svc === MIN_SESSIONS_REQUIRED) completeUUIDs.add(uuid);
}
const completePptByCondition: Record<number, Set<string>> = {};
for (let i = 0; i < 8; i++) completePptByCondition[i] = new Set();
for (const s of sessions) {
  if (!completePptByCondition[s.ai_advice]) completePptByCondition[s.ai_advice] = new Set();
  if (completeUUIDs.has(s.user_uuid)) completePptByCondition[s.ai_advice].add(s.user_uuid);
}

// All observed ai_advice values (including any undocumented ones)
const allAiTypes = [...new Set(sessions.map((s) => s.ai_advice))].sort((a, b) => a - b);

// Output
const result = {
  runDate: new Date().toISOString(),
  cohort: {
    totalSessions: sessions.length,
    uniqueParticipants: uniqueParticipants.size,
    completeParticipants,
    totalSurveys: surveys.length,
    dateRange,
    gamesPlayedMismatches,
    unknownAiTypes: allAiTypes.filter((t) => !AI_TYPE_LABELS[t]),
  },
  conditionBalance: Object.fromEntries(
    allAiTypes.map((i) => [
      AI_TYPE_LABELS[i] ?? `UNKNOWN_${i}`,
      {
        sessions: conditionSessionCounts[i] ?? 0,
        completePptN: (completePptByCondition[i] ?? new Set()).size,
        boardFamily: conditionBoardFamilyCounts[i] ?? { perlin: 0, gaussian: 0 },
        skillMean: conditionSkillMeans[i] ?? null,
      },
    ]),
  ),
  byCondition,
  correlationMatrix: corrMatrix,
  q1_2_trajectory: trajectory,
  q1_1_kruskalWallis: kw_score,
};

console.log(JSON.stringify(result, null, 2));

// Append row to reports/series/metrics.csv
const csvPath = path.join(PROJECT_ROOT, "reports", "series", "metrics.csv");
const scorePhit = byCondition["scorePerHit"];

function fmtCsv(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return "";
  return v.toFixed(4);
}

const row = [
  new Date().toISOString().slice(0, 10),
  sessions.length,
  uniqueParticipants.size,
  completeParticipants,
  fmtCsv(scorePhit["NONE"]?.mean),
  fmtCsv(scorePhit["CORRECT"]?.mean),
  fmtCsv(scorePhit["PLAUSIBLE"]?.mean),
  fmtCsv(scorePhit["RANDOM"]?.mean),
  fmtCsv(scorePhit["WRONG"]?.mean),
  fmtCsv(scorePhit["BAD"]?.mean),
  fmtCsv(scorePhit["GOOD_PLAUSIBLE"]?.mean),
  fmtCsv(scorePhit["PLAUSIBLE_GOOD"]?.mean),
  fmtCsv(trajectory.cohenD.d),
  fmtCsv(trajectory.cohenD.ci_low),
  fmtCsv(trajectory.cohenD.ci_high),
  "OK",
].join(",");
fs.appendFileSync(csvPath, row + "\n");
console.error(`Appended metrics row to ${csvPath}`);
