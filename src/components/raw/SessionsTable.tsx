// All colors in this file must follow PALETTE.md at the project root.
import { useState, useMemo } from "react";
import type { ParsedGameSession, ParsedSurveyResponse } from "../../loaders/loadData";
import type { RewardSurface } from "../../types/dart";
import { AI_Type } from "../../types/dart";
import { AI_TYPE_LABELS, AI_TYPE_COLORS } from "../../utils/stats";
import { computeSessionScore, computeSessionHitDispersion } from "../../utils/scoreStats";
import { joinSessionsWithSurvey } from "../../utils/surveyStats";
import { buildSessionVariableRows } from "../../utils/variables";
import type { EvGrids } from "../../loaders/loadEvGrids";
import { RawTableCard } from "./RawTableCard";

interface Props {
  sessions: ParsedGameSession[];
  surveys: ParsedSurveyResponse[];
  boards: Map<number, RewardSurface>;
  evGrids: EvGrids;
}

export interface SessionTableRow {
  session: ParsedGameSession;
  participant: string;
  uuid: string | null;
  condition: string;
  conditionType: AI_Type;
  skill: number;
  gamesPlayed: number;
  gamesActual: number;
  avgHitCount: number;
  totalScore: number;
  score: number;
  scorePerHit: number | null;
  proxAI: number | null;
  proxOptimal: number | null;
  dispersionMean: number | null;
  dispersionStd: number | null;
  evGap: number | null;
  trust: number | null;
  influence: number | null;
  satisfied: number | null;
  luck: number | null;
  date: string;
}

type SortKey = Exclude<keyof SessionTableRow, "session" | "conditionType">;
type SortDir = "asc" | "desc";

/**
 * Builds the Raw Data sessions table rows, including the extrapolated
 * session-level variables (per-hit score, proximities, dispersion, EV gap) and
 * the joined survey dimensions. Pure + exported so it can be unit-tested
 * without rendering the component. EV gap uses the precomputed EV grids and is
 * null for sessions whose (board, skill) pairs have no grid.
 */
export function buildSessionTableRows(
  sessions: ParsedGameSession[],
  surveys: ParsedSurveyResponse[],
  boards: Map<number, RewardSurface>,
  evGrids: EvGrids = new Map(),
): SessionTableRow[] {
  const joined = joinSessionsWithSurvey(sessions, surveys);
  const varRows = buildSessionVariableRows(joined, boards, evGrids);

  return sessions.map((s, i) => {
    const v = varRows[i];
    const sessionScore = computeSessionScore(s, boards);
    const disp = s.games.length > 0 ? computeSessionHitDispersion(s) : null;
    const totalHits = s.games.reduce((sum, g) => sum + g.hits.length, 0);
    const avgHitCount = s.games.length > 0 ? totalHits / s.games.length : 0;

    return {
      session: s,
      participant: s.user_nickname ?? "",
      uuid: s.user_uuid,
      condition: AI_TYPE_LABELS[s.ai_advice],
      conditionType: s.ai_advice,
      skill: s.execution_skill,
      gamesPlayed: s.games_played,
      gamesActual: s.games.length,
      avgHitCount,
      totalScore: sessionScore.sum,
      score: sessionScore.avg,
      scorePerHit: v.scorePerHit,
      proxAI: v.proxAI,
      proxOptimal: v.proxOptimal,
      dispersionMean: disp ? disp.mean : null,
      dispersionStd: disp ? disp.std : null,
      evGap: v.evGap,
      trust: v.trust,
      influence: v.influence,
      satisfied: v.satisfied,
      luck: v.luck,
      date: s.created_at.slice(0, 10),
    };
  });
}

const CSV_COLUMNS: { header: string; get: (r: SessionTableRow) => string }[] = [
  { header: "participant", get: (r) => `"${r.participant}"` },
  { header: "user_uuid", get: (r) => r.uuid ?? "" },
  { header: "condition", get: (r) => `"${r.condition}"` },
  { header: "execution_skill", get: (r) => String(r.skill) },
  { header: "games_played", get: (r) => String(r.gamesPlayed) },
  { header: "games_in_data", get: (r) => String(r.gamesActual) },
  { header: "avg_hit_count", get: (r) => r.avgHitCount.toFixed(2) },
  { header: "total_score", get: (r) => r.totalScore.toFixed(4) },
  { header: "avg_score_per_game", get: (r) => r.score.toFixed(4) },
  { header: "score_per_hit", get: (r) => csvNum(r.scorePerHit, 4) },
  { header: "prox_ai", get: (r) => csvNum(r.proxAI, 4) },
  { header: "prox_optimal", get: (r) => csvNum(r.proxOptimal, 4) },
  { header: "dispersion_mean", get: (r) => csvNum(r.dispersionMean, 4) },
  { header: "dispersion_std", get: (r) => csvNum(r.dispersionStd, 4) },
  { header: "ev_gap", get: (r) => csvNum(r.evGap, 4) },
  { header: "trust", get: (r) => csvNum(r.trust, 0) },
  { header: "influence", get: (r) => csvNum(r.influence, 0) },
  { header: "satisfied", get: (r) => csvNum(r.satisfied, 0) },
  { header: "luck", get: (r) => csvNum(r.luck, 0) },
  { header: "date", get: (r) => r.date },
];

function csvNum(v: number | null, digits: number): string {
  return v === null ? "" : v.toFixed(digits);
}

function exportCSV(rows: SessionTableRow[]) {
  // Export in the current on-screen order (driven by the Sort-by dropdown).
  const lines = [
    CSV_COLUMNS.map((c) => c.header).join(","),
    ...rows.map((r) => CSV_COLUMNS.map((c) => c.get(r)).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sessions_export.csv";
  a.click();
  URL.revokeObjectURL(url);
}

type FilterField = "condition" | "uuid" | "scorePerHit";

export function SessionsTable({ sessions, surveys, boards, evGrids }: Props) {
  const [filterField, setFilterField] = useState<FilterField>("condition");
  const [conditionFilter, setConditionFilter] = useState<string>("all");
  const [uuidQuery, setUuidQuery] = useState("");
  const [scoreMin, setScoreMin] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "date", dir: "asc" });

  const rows = useMemo(
    () => buildSessionTableRows(sessions, surveys, boards, evGrids),
    [sessions, surveys, boards, evGrids],
  );

  const filtered = useMemo(() => {
    let r = rows;
    if (filterField === "condition") {
      if (conditionFilter !== "all")
        r = r.filter((row) => row.conditionType === Number(conditionFilter));
    } else if (filterField === "uuid") {
      const q = uuidQuery.trim().toLowerCase();
      if (q) r = r.filter((row) => (row.uuid ?? "").toLowerCase().includes(q));
    } else if (filterField === "scorePerHit") {
      const min = parseFloat(scoreMin);
      if (!Number.isNaN(min))
        r = r.filter((row) => row.scorePerHit !== null && row.scorePerHit >= min);
    }
    return r;
  }, [rows, filterField, conditionFilter, uuidQuery, scoreMin]);

  const sorted = useMemo(() => {
    const { key, dir } = sort;
    return [...filtered].sort((a, b) => {
      // The "date" key sorts on the full created_at timestamp (the date cell
      // only shows YYYY-MM-DD, so a raw cell compare would tie within a day).
      if (key === "date") {
        const cmp = a.session.created_at.localeCompare(b.session.created_at);
        return dir === "asc" ? cmp : -cmp;
      }
      const va = a[key];
      const vb = b[key];
      // Nulls always sort to the end regardless of direction.
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
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
    if (sort.key !== k) return <span style={{ color: "#d1d5db", fontSize: 10 }}> ↕</span>;
    return <span style={{ fontSize: 10 }}> {sort.dir === "asc" ? "▲" : "▼"}</span>;
  }

  const inputStyle: React.CSSProperties = {
    background: "#ffffff",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    color: "#111827",
    padding: "4px 10px",
    fontSize: 12,
    fontFamily: "inherit",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    color: "#6b7280",
  };

  const numCell: React.CSSProperties = {
    color: "#111827",
    fontVariantNumeric: "tabular-nums",
    textAlign: "right",
  };

  function NumCol({ k, label }: { k: SortKey; label: string }) {
    return (
      <th onClick={() => toggleSort(k)} style={{ cursor: "pointer", textAlign: "right" }}>
        {label}
        <SortIcon k={k} />
      </th>
    );
  }

  function num(v: number | null, digits: number) {
    if (v === null) return <span style={{ color: "#9ca3af" }}>—</span>;
    return v.toFixed(digits);
  }

  return (
    <RawTableCard title={`session_stats_summary (${sorted.length} of ${sessions.length})`}>
      <p className="raw-schema">
        One row per session. CSV columns: <code>participant</code>, <code>user_uuid</code>,{" "}
        <code>condition</code>, <code>execution_skill</code>, <code>games_played</code>,{" "}
        <code>games_in_data</code>, <code>avg_hit_count</code>, <code>total_score</code>,{" "}
        <code>avg_score_per_game</code>, <code>score_per_hit</code>, <code>prox_ai</code>,{" "}
        <code>prox_optimal</code>, <code>dispersion_mean</code>, <code>dispersion_std</code>,{" "}
        <code>ev_gap</code>, <code>trust</code>, <code>influence</code>, <code>satisfied</code>,{" "}
        <code>luck</code>, <code>date</code>. All score/proximity/dispersion/EV columns are derived
        from the board surfaces; survey columns are the nearest matching response.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <label style={labelStyle}>Sort by</label>
        <select
          value={sort.key === "date" && sort.dir === "asc" ? "oldest" : "newest"}
          onChange={(e) =>
            setSort({ key: "date", dir: e.target.value === "oldest" ? "asc" : "desc" })
          }
          style={inputStyle}
        >
          <option value="oldest">Oldest</option>
          <option value="newest">Newest</option>
        </select>

        <label style={{ ...labelStyle, marginLeft: 8 }}>Filter by</label>
        <select
          value={filterField}
          onChange={(e) => setFilterField(e.target.value as FilterField)}
          style={inputStyle}
        >
          <option value="condition">AI Condition</option>
          <option value="uuid">UUID</option>
          <option value="scorePerHit">Score/Hit</option>
        </select>

        {filterField === "condition" && (
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
        )}
        {filterField === "uuid" && (
          <input
            type="text"
            placeholder="Match UUID…"
            value={uuidQuery}
            onChange={(e) => setUuidQuery(e.target.value)}
            style={{ ...inputStyle, minWidth: 220 }}
          />
        )}
        {filterField === "scorePerHit" && (
          <input
            type="number"
            step="0.1"
            placeholder="≥ min score/hit"
            value={scoreMin}
            onChange={(e) => setScoreMin(e.target.value)}
            style={{ ...inputStyle, minWidth: 140 }}
          />
        )}

        <button
          onClick={() => exportCSV(sorted)}
          style={{ ...inputStyle, marginLeft: "auto", cursor: "pointer", color: "#374151" }}
        >
          Export CSV
        </button>
      </div>

      <div className="table-scroll table-scroll--boxed">
        <table className="data-table">
          <thead>
            <tr>
              <th onClick={() => toggleSort("participant")} style={{ cursor: "pointer" }}>Participant<SortIcon k="participant" /></th>
              <th onClick={() => toggleSort("uuid")} style={{ cursor: "pointer" }}>UUID<SortIcon k="uuid" /></th>
              <th onClick={() => toggleSort("condition")} style={{ cursor: "pointer" }}>Condition<SortIcon k="condition" /></th>
              <NumCol k="skill" label="Exec Skill" />
              <NumCol k="gamesPlayed" label="Games (CSV)" />
              <NumCol k="gamesActual" label="Games (data)" />
              <NumCol k="avgHitCount" label="Avg Hits/Game" />
              <NumCol k="totalScore" label="Total Score" />
              <NumCol k="score" label="Avg Score/Game" />
              <NumCol k="scorePerHit" label="Score/Hit" />
              <NumCol k="proxAI" label="Prox AI" />
              <NumCol k="proxOptimal" label="Prox Optimal" />
              <NumCol k="dispersionMean" label="Disp μ" />
              <NumCol k="dispersionStd" label="Disp σ" />
              <NumCol k="evGap" label="EV Gap" />
              <NumCol k="trust" label="Trust" />
              <NumCol k="influence" label="Influence" />
              <NumCol k="satisfied" label="Satisfied" />
              <NumCol k="luck" label="Luck" />
              <th onClick={() => toggleSort("date")} style={{ cursor: "pointer" }}>Date<SortIcon k="date" /></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={i}>
                <td style={{ color: "#111827" }}>{r.participant || <span style={{ color: "#9ca3af" }}>—</span>}</td>
                <td>
                  <span title={r.uuid ?? ""} style={{ fontFamily: "monospace", fontSize: 11 }}>
                    {r.uuid ? `${r.uuid.slice(0, 8)}…` : <span style={{ color: "#9ca3af" }}>—</span>}
                  </span>
                </td>
                <td>
                  <span className="condition-badge" style={{ background: AI_TYPE_COLORS[r.conditionType] }}>
                    {r.condition}
                  </span>
                </td>
                <td style={numCell}>{r.skill}</td>
                <td style={numCell}>{r.gamesPlayed}</td>
                <td style={{ ...numCell, color: r.gamesPlayed !== r.gamesActual ? "#dc2626" : "#6b7280" }}>
                  {r.gamesActual}
                </td>
                <td style={numCell}>{r.avgHitCount.toFixed(1)}</td>
                <td style={numCell}>{r.totalScore.toFixed(1)}</td>
                <td style={numCell}>{r.score.toFixed(2)}</td>
                <td style={numCell}>{num(r.scorePerHit, 2)}</td>
                <td style={numCell}>{num(r.proxAI, 1)}</td>
                <td style={numCell}>{num(r.proxOptimal, 1)}</td>
                <td style={numCell}>{num(r.dispersionMean, 1)}</td>
                <td style={numCell}>{num(r.dispersionStd, 1)}</td>
                <td style={numCell}>{num(r.evGap, 2)}</td>
                <td style={numCell}>{num(r.trust, 0)}</td>
                <td style={numCell}>{num(r.influence, 0)}</td>
                <td style={numCell}>{num(r.satisfied, 0)}</td>
                <td style={numCell}>{num(r.luck, 0)}</td>
                <td>{r.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 11, color: "#6b7280" }}>
        "Games (CSV)" is the games_played field; "Games (data)" is the actual games array length —
        highlighted red if they differ. Score/Hit, proximities, dispersion, and EV gap are the
        extrapolated session-level variables; survey columns are the nearest matching response.
        EV gap = score/hit − EV of the actual aim (from the precomputed EV grids); blank when no
        grid covers the session's board/skill pairs.
      </p>
    </RawTableCard>
  );
}
