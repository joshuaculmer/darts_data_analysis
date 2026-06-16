// All colors in this file must follow PALETTE.md at the project root.
import Papa from "papaparse";
import { useState, useMemo } from "react";
import type { ParsedGameSession } from "../../loaders/loadData";
import type { Coord } from "../../types/dart";
import { AI_TYPE_LABELS } from "../../utils/stats";
import { RawTableCard } from "./RawTableCard";

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
 */
export function buildGameDataRows(sessions: ParsedGameSession[]): GameDataRow[] {
  return sessions.flatMap((s) =>
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

/**
 * Reconstructs the raw game_sessions table as exported from Supabase — original
 * columns with the `games` array serialized back to a JSON string. Built from
 * the parsed sessions so it works whether the data came from a CSV upload or
 * the Supabase fetch.
 */
function exportRawGameSessions(sessions: ParsedGameSession[]) {
  const raw = sessions.map((s) => ({
    id: s.id,
    created_at: s.created_at,
    user_uuid: s.user_uuid,
    user_nickname: s.user_nickname ?? "",
    execution_skill: s.execution_skill,
    games_played: s.games_played,
    ai_advice: s.ai_advice,
    games: JSON.stringify(s.games),
  }));
  downloadCSV(Papa.unparse(raw), "game_sessions_raw.csv");
}

export function GameDataTable({ sessions }: Props) {
  const [search, setSearch] = useState("");

  const rows = useMemo(() => buildGameDataRows(sessions), [sessions]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) => r.uuid.toLowerCase().includes(q) || r.nickname.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const inputStyle: React.CSSProperties = {
    background: "#ffffff",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    color: "#111827",
    padding: "4px 10px",
    fontSize: 12,
    fontFamily: "inherit",
  };

  const numCell: React.CSSProperties = {
    color: "#111827",
    fontVariantNumeric: "tabular-nums",
    textAlign: "right",
  };

  function coord(x: number | null, y: number | null) {
    if (x === null || y === null || Number.isNaN(x) || Number.isNaN(y))
      return <span style={{ color: "#9ca3af" }}>—</span>;
    return `(${x.toFixed(1)}, ${y.toFixed(1)})`;
  }

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

      <div className="table-scroll table-scroll--boxed">
        <table className="data-table">
          <thead>
            <tr>
              <th>UUID</th>
              <th style={{ textAlign: "right" }}>Game #</th>
              <th style={{ textAlign: "right" }}>Board</th>
              <th style={{ textAlign: "right" }}>Suggested Aim</th>
              <th style={{ textAlign: "right" }}>Actual Aim</th>
              <th style={{ textAlign: "right" }}>Hits</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={i}>
                <td>
                  <span title={r.uuid} style={{ fontFamily: "monospace", fontSize: 11 }}>
                    {r.uuid ? `${r.uuid.slice(0, 8)}…` : <span style={{ color: "#9ca3af" }}>—</span>}
                  </span>
                </td>
                <td style={numCell}>{r.gameIndex}</td>
                <td style={numCell}>{r.boardId}</td>
                <td style={numCell}>{coord(r.suggestedX, r.suggestedY)}</td>
                <td style={numCell}>{coord(r.actualX, r.actualY)}</td>
                <td style={numCell}>{r.hitCount}</td>
                <td>{r.createdAt.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 11, color: "#6b7280" }}>
        One row per game (the flattened <code>games</code> column). "Export game_data CSV" writes
        every game with its full hit array as JSON; "Export raw game_sessions CSV" reconstructs the
        original Supabase game_sessions table (one row per session, <code>games</code> as a JSON
        string).
      </p>
    </RawTableCard>
  );
}
