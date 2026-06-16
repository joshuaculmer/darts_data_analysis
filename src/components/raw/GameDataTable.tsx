// All colors in this file must follow PALETTE.md at the project root.
import Papa from "papaparse";
import { useState, useMemo } from "react";
import type { ParsedGameSession } from "../../loaders/loadData";
import type { Coord } from "../../types/dart";
import { AI_TYPE_LABELS } from "../../utils/stats";
import { useDebouncedValue } from "../../utils/useDebouncedValue";
import { RawTableCard } from "./RawTableCard";
import { VirtualizedTable } from "./VirtualizedTable";
import type { VirtualColumn } from "./VirtualizedTable";

interface Props {
  sessions: ParsedGameSession[];
}

export interface GameDataRow {
  sessionId: string;
  createdAt: string;
  uuid: string;
  nickname: string;
  skill: number;
  aiAdvice: number;
  condition: string;
  gameIndex: number;
  boardId: number;
  start: number;
  end: number;
  suggestedX: number | null;
  suggestedY: number | null;
  actualX: number;
  actualY: number;
  hitCount: number;
  hits: Coord[];
}

/**
 * Flattens the `games` column of every session into one row per game. This is
 * the raw game data straight out of the session DTOs — no derived scores.
 * Pure + exported so it can be unit-tested without rendering.
 *
 * Ordering contract: rows come back grouped by participant, and within each
 * participant the games are sorted by their `start` timestamp ascending (true
 * per-game chronology — participants run concurrently, so `start` is the only
 * reliable clock; the session `created_at` is just the upload time, identical
 * for every game in a session). Every game has a distinct `start`, so no
 * tiebreaker fallback is needed. Both the on-screen table and the CSV export
 * read from this single ordered list, so any future sort/filter must preserve
 * this contract: group by the chosen qualifier first, then `start` ascending.
 */
export function buildGameDataRows(sessions: ParsedGameSession[]): GameDataRow[] {
  const rows = sessions.flatMap((s) =>
    s.games.map((g, i) => ({
      sessionId: s.id,
      createdAt: s.created_at,
      uuid: s.user_uuid,
      nickname: s.user_nickname ?? "",
      skill: s.execution_skill,
      aiAdvice: s.ai_advice,
      condition: AI_TYPE_LABELS[s.ai_advice],
      gameIndex: i,
      boardId: g.board_id,
      start: g.start,
      end: g.end,
      suggestedX: g.suggested_aiming_coord?.x ?? null,
      suggestedY: g.suggested_aiming_coord?.y ?? null,
      actualX: g.actual_aiming_coord?.x ?? NaN,
      actualY: g.actual_aiming_coord?.y ?? NaN,
      hitCount: g.hits.length,
      hits: g.hits,
    })),
  );

  return rows.sort((a, b) => {
    // Group by participant: display name first, then UUID so a participant's
    // games stay contiguous even if two participants share a nickname.
    const byName = (a.nickname || a.uuid).localeCompare(b.nickname || b.uuid);
    if (byName !== 0) return byName;
    const byUuid = a.uuid.localeCompare(b.uuid);
    if (byUuid !== 0) return byUuid;
    // Within a participant, chronological by game start.
    return a.start - b.start;
  });
}

function csvNum(v: number | null): string {
  return v === null || Number.isNaN(v) ? "" : String(v);
}

const GAME_DATA_COLUMNS: { header: string; get: (r: GameDataRow) => string }[] = [
  { header: "session_id", get: (r) => r.sessionId },
  { header: "created_at", get: (r) => r.createdAt },
  { header: "user_uuid", get: (r) => r.uuid },
  { header: "user_nickname", get: (r) => `"${r.nickname}"` },
  { header: "execution_skill", get: (r) => String(r.skill) },
  { header: "ai_advice", get: (r) => String(r.aiAdvice) },
  { header: "condition", get: (r) => `"${r.condition}"` },
  { header: "game_index", get: (r) => String(r.gameIndex) },
  { header: "board_id", get: (r) => String(r.boardId) },
  { header: "start", get: (r) => csvNum(r.start) },
  { header: "end", get: (r) => csvNum(r.end) },
  { header: "suggested_aim_x", get: (r) => csvNum(r.suggestedX) },
  { header: "suggested_aim_y", get: (r) => csvNum(r.suggestedY) },
  { header: "actual_aim_x", get: (r) => csvNum(r.actualX) },
  { header: "actual_aim_y", get: (r) => csvNum(r.actualY) },
  { header: "hit_count", get: (r) => String(r.hitCount) },
  { header: "hits", get: (r) => `"${JSON.stringify(r.hits).replace(/"/g, '""')}"` },
];

function downloadCSV(text: string, filename: string) {
  const blob = new Blob([text], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportGameData(rows: GameDataRow[]) {
  const lines = [
    GAME_DATA_COLUMNS.map((c) => c.header).join(","),
    ...rows.map((r) => GAME_DATA_COLUMNS.map((c) => c.get(r)).join(",")),
  ];
  downloadCSV(lines.join("\n"), "game_data_export.csv");
}

export interface RawGameSessionRow {
  id: string;
  created_at: string;
  user_uuid: string;
  user_nickname: string;
  execution_skill: number;
  games_played: number;
  ai_advice: number;
  games: string;
}

/**
 * Reconstructs the raw game_sessions table as exported from Supabase — original
 * columns with the `games` array serialized back to a JSON string. Built from
 * the parsed sessions so it works whether the data came from a CSV upload or
 * the Supabase fetch. Pure + exported so it can be unit-tested.
 *
 * Honors the same ordering contract as buildGameDataRows: sessions are grouped
 * by participant (then ordered by their earliest game start), and each
 * session's nested `games` array is sorted by `start` ascending.
 */
export function buildRawGameSessionRows(sessions: ParsedGameSession[]): RawGameSessionRow[] {
  const minStart = (s: ParsedGameSession) =>
    s.games.length > 0 ? Math.min(...s.games.map((g) => g.start)) : Infinity;

  return [...sessions]
    .sort((a, b) => {
      const byName = (a.user_nickname || a.user_uuid).localeCompare(
        b.user_nickname || b.user_uuid,
      );
      if (byName !== 0) return byName;
      const byUuid = a.user_uuid.localeCompare(b.user_uuid);
      if (byUuid !== 0) return byUuid;
      // Same participant: order their sessions chronologically by first game.
      return minStart(a) - minStart(b);
    })
    .map((s) => ({
      id: s.id,
      created_at: s.created_at,
      user_uuid: s.user_uuid,
      user_nickname: s.user_nickname ?? "",
      execution_skill: s.execution_skill,
      games_played: s.games_played,
      ai_advice: s.ai_advice,
      games: JSON.stringify([...s.games].sort((g1, g2) => g1.start - g2.start)),
    }));
}

function exportRawGameSessions(sessions: ParsedGameSession[]) {
  downloadCSV(Papa.unparse(buildRawGameSessionRows(sessions)), "game_sessions_raw.csv");
}

export function GameDataTable({ sessions }: Props) {
  const [search, setSearch] = useState("");

  const rows = useMemo(() => buildGameDataRows(sessions), [sessions]);

  const debouncedSearch = useDebouncedValue(search);
  const filtered = useMemo(() => {
    if (!debouncedSearch.trim()) return rows;
    const q = debouncedSearch.trim().toLowerCase();
    return rows.filter(
      (r) => r.uuid.toLowerCase().includes(q) || r.nickname.toLowerCase().includes(q),
    );
  }, [rows, debouncedSearch]);

  const inputStyle: React.CSSProperties = {
    background: "#ffffff",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    color: "#111827",
    padding: "4px 10px",
    fontSize: 12,
    fontFamily: "inherit",
  };

  function coord(x: number | null, y: number | null) {
    if (x === null || y === null || Number.isNaN(x) || Number.isNaN(y))
      return <span style={{ color: "#9ca3af" }}>—</span>;
    return `(${x.toFixed(1)}, ${y.toFixed(1)})`;
  }

  const columns: VirtualColumn<GameDataRow>[] = [
    {
      key: "uuid",
      header: "UUID",
      width: 130,
      cell: (r) => (
        <span title={r.uuid} style={{ fontFamily: "monospace", fontSize: 11 }}>
          {r.uuid ? `${r.uuid.slice(0, 8)}…` : <span style={{ color: "#9ca3af" }}>—</span>}
        </span>
      ),
    },
    { key: "gameIndex", header: "Game #", width: 80, numeric: true, cell: (r) => r.gameIndex },
    { key: "boardId", header: "Board", width: 80, numeric: true, cell: (r) => r.boardId },
    {
      key: "suggested",
      header: "Suggested Aim",
      width: 140,
      align: "right",
      cell: (r) => coord(r.suggestedX, r.suggestedY),
    },
    {
      key: "actual",
      header: "Actual Aim",
      width: 140,
      align: "right",
      cell: (r) => coord(r.actualX, r.actualY),
    },
    { key: "hitCount", header: "Hits", width: 80, numeric: true, cell: (r) => r.hitCount },
    { key: "date", header: "Date", width: 120, cell: (r) => r.createdAt.slice(0, 10) },
  ];

  return (
    <RawTableCard title={`game_data (${filtered.length} of ${rows.length} games)`}>
      <p className="raw-schema">
        One row per game (the flattened <code>games</code> column). CSV columns:{" "}
        <code>session_id</code>, <code>created_at</code>, <code>user_uuid</code>,{" "}
        <code>user_nickname</code>, <code>execution_skill</code>, <code>ai_advice</code>,{" "}
        <code>condition</code>, <code>game_index</code>, <code>board_id</code>, <code>start</code>,{" "}
        <code>end</code>, <code>suggested_aim_x</code>,{" "}
        <code>suggested_aim_y</code>, <code>actual_aim_x</code>, <code>actual_aim_y</code>,{" "}
        <code>hit_count</code>, <code>hits</code> (full hit array as JSON). Values are the raw game
        fields — no derived scores.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Filter by participant or UUID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle, minWidth: 220 }}
        />
        <button
          onClick={() => exportGameData(filtered)}
          style={{ ...inputStyle, marginLeft: "auto", cursor: "pointer", color: "#374151" }}
        >
          Export game_data CSV
        </button>
        <button
          onClick={() => exportRawGameSessions(sessions)}
          style={{ ...inputStyle, cursor: "pointer", color: "#374151" }}
        >
          Export raw game_sessions CSV
        </button>
      </div>

      <VirtualizedTable columns={columns} rows={filtered} rowKey={(_r, i) => i} />
      <p style={{ fontSize: 11, color: "#6b7280" }}>
        One row per game (the flattened <code>games</code> column). "Export game_data CSV" writes
        every game with its full hit array as JSON; "Export raw game_sessions CSV" reconstructs the
        original Supabase game_sessions table (one row per session, <code>games</code> as a JSON
        string).
      </p>
    </RawTableCard>
  );
}
