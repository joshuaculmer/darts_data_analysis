import { useState, useMemo } from "react";
import type { ParsedGameSession } from "../../loaders/loadData";
import type { RewardSurface } from "../../types/dart";
import { AI_Type } from "../../types/dart";
import { AI_TYPE_LABELS, AI_TYPE_COLORS } from "../../utils/stats";
import { computeSessionScore } from "../../utils/scoreStats";

interface Props {
  sessions: ParsedGameSession[];
  boards: Map<number, RewardSurface>;
}

type SortKey = "participant" | "uuid" | "condition" | "skill" | "gamesPlayed" | "gamesActual" | "score" | "date";
type SortDir = "asc" | "desc";

function exportCSV(rows: ReturnType<typeof buildRows>) {
  const headers = ["participant", "user_uuid", "condition", "execution_skill", "games_played", "games_in_data", "avg_score_per_game", "date"];
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        `"${r.participant}"`,
        r.uuid ?? "",
        `"${r.condition}"`,
        r.skill,
        r.gamesPlayed,
        r.gamesActual,
        r.score.toFixed(4),
        r.date,
      ].join(",")
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sessions_export.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function buildRows(sessions: ParsedGameSession[], boards: Map<number, RewardSurface>) {
  return sessions.map((s) => ({
    session: s,
    participant: s.user_nickname ?? "",
    uuid: s.user_uuid,
    condition: AI_TYPE_LABELS[s.ai_advice],
    conditionType: s.ai_advice,
    skill: s.execution_skill,
    gamesPlayed: s.games_played,
    gamesActual: s.games.length,
    score: computeSessionScore(s, boards).avg,
    date: s.created_at.slice(0, 10),
  }));
}

export function SessionsTable({ sessions, boards }: Props) {
  const [search, setSearch] = useState("");
  const [conditionFilter, setConditionFilter] = useState<string>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "date", dir: "asc" });

  const rows = useMemo(() => buildRows(sessions, boards), [sessions, boards]);

  const filtered = useMemo(() => {
    let r = rows;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter(
        (row) =>
          row.participant.toLowerCase().includes(q) ||
          (row.uuid ?? "").toLowerCase().includes(q)
      );
    }
    if (conditionFilter !== "all") {
      r = r.filter((row) => row.conditionType === Number(conditionFilter));
    }
    return r;
  }, [rows, search, conditionFilter]);

  const sorted = useMemo(() => {
    const { key, dir } = sort;
    return [...filtered].sort((a, b) => {
      const va = a[key];
      const vb = b[key];
      if (typeof va === "number" && typeof vb === "number")
        return dir === "asc" ? va - vb : vb - va;
      return dir === "asc"
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });
  }, [filtered, sort]);

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sort.key !== k) return <span style={{ color: "#334155", fontSize: 10 }}> ↕</span>;
    return <span style={{ fontSize: 10 }}> {sort.dir === "asc" ? "▲" : "▼"}</span>;
  }

  const inputStyle: React.CSSProperties = {
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: 6,
    color: "#e2e8f0",
    padding: "4px 10px",
    fontSize: 12,
  };

  return (
    <div className="chart-card">
      <h2>Sessions ({sorted.length} of {sessions.length})</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Filter by participant or UUID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle, minWidth: 220 }}
        />
        <select
          value={conditionFilter}
          onChange={(e) => setConditionFilter(e.target.value)}
          style={inputStyle}
        >
          <option value="all">All conditions</option>
          {(Object.values(AI_Type).filter((v) => typeof v === "number") as AI_Type[]).map((t) => (
            <option key={t} value={t}>{AI_TYPE_LABELS[t]}</option>
          ))}
        </select>
        <button
          onClick={() => exportCSV(sorted)}
          style={{ ...inputStyle, marginLeft: "auto", cursor: "pointer", color: "#94a3b8" }}
        >
          Export CSV
        </button>
      </div>

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th onClick={() => toggleSort("participant")} style={{ cursor: "pointer" }}>Participant<SortIcon k="participant" /></th>
              <th onClick={() => toggleSort("uuid")} style={{ cursor: "pointer" }}>UUID<SortIcon k="uuid" /></th>
              <th onClick={() => toggleSort("condition")} style={{ cursor: "pointer" }}>Condition<SortIcon k="condition" /></th>
              <th onClick={() => toggleSort("skill")} style={{ cursor: "pointer" }}>Exec Skill<SortIcon k="skill" /></th>
              <th onClick={() => toggleSort("gamesPlayed")} style={{ cursor: "pointer" }}>Games (CSV)<SortIcon k="gamesPlayed" /></th>
              <th onClick={() => toggleSort("gamesActual")} style={{ cursor: "pointer" }}>Games (data)<SortIcon k="gamesActual" /></th>
              <th onClick={() => toggleSort("score")} style={{ cursor: "pointer" }}>Avg Score/Game<SortIcon k="score" /></th>
              <th onClick={() => toggleSort("date")} style={{ cursor: "pointer" }}>Date<SortIcon k="date" /></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={i}>
                <td style={{ color: "#e2e8f0" }}>{r.participant || <span style={{ color: "#475569" }}>—</span>}</td>
                <td>
                  <span title={r.uuid ?? ""} style={{ fontFamily: "monospace", fontSize: 11 }}>
                    {r.uuid ? `${r.uuid.slice(0, 8)}…` : <span style={{ color: "#475569" }}>—</span>}
                  </span>
                </td>
                <td>
                  <span className="condition-badge" style={{ background: AI_TYPE_COLORS[r.conditionType] }}>
                    {r.condition}
                  </span>
                </td>
                <td>{r.skill}</td>
                <td>{r.gamesPlayed}</td>
                <td style={{ color: r.gamesPlayed !== r.gamesActual ? "#f87171" : "#94a3b8" }}>
                  {r.gamesActual}
                </td>
                <td style={{ color: "#f1f5f9", fontVariantNumeric: "tabular-nums" }}>
                  {r.score.toFixed(2)}
                </td>
                <td>{r.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 11, color: "#475569" }}>
        "Games (CSV)" is the games_played field; "Games (data)" is the actual games array length — highlighted red if they differ.
      </p>
    </div>
  );
}
