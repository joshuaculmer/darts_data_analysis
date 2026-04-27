// All colors in this file must follow PALETTE.md at the project root.
import { useState, useMemo } from "react";
import type { ParsedSurveyResponse } from "../../loaders/loadData";

interface Props {
  surveys: ParsedSurveyResponse[];
}

type SortDir = "asc" | "desc";

function exportCSV(rows: ParsedSurveyResponse[], questionIds: string[]) {
  const headers = ["participant", "user_uuid", "date", ...questionIds];
  const lines = [
    headers.join(","),
    ...rows.map((s) => {
      const answerMap = Object.fromEntries(s.responses.map((r) => [r.questionId, r.value]));
      return [
        `"${s.user_nickname ?? ""}"`,
        s.user_uuid ?? "",
        s.created_at.slice(0, 10),
        ...questionIds.map((qId) => {
          const v = answerMap[qId];
          return v !== undefined ? `"${v}"` : "";
        }),
      ].join(",");
    }),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "survey_export.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function SurveyTable({ surveys }: Props) {
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<"participant" | "uuid" | "date">("date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const questionIds = useMemo(
    () =>
      Array.from(new Set(surveys.flatMap((s) => s.responses.map((r) => r.questionId)))).sort(),
    [surveys]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return surveys;
    const q = search.trim().toLowerCase();
    return surveys.filter(
      (s) =>
        (s.user_nickname ?? "").toLowerCase().includes(q) ||
        (s.user_uuid ?? "").toLowerCase().includes(q)
    );
  }, [surveys, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va: string, vb: string;
      if (sortCol === "participant") {
        va = a.user_nickname ?? a.user_uuid;
        vb = b.user_nickname ?? b.user_uuid;
      } else if (sortCol === "uuid") {
        va = a.user_uuid ?? "";
        vb = b.user_uuid ?? "";
      } else {
        va = a.created_at;
        vb = b.created_at;
      }
      return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }, [filtered, sortCol, sortDir]);

  function toggleSort(col: "participant" | "uuid" | "date") {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }

  function SortIcon({ k }: { k: "participant" | "uuid" | "date" }) {
    if (sortCol !== k) return <span style={{ color: "#d1d5db", fontSize: 10 }}> ↕</span>;
    return <span style={{ fontSize: 10 }}> {sortDir === "asc" ? "▲" : "▼"}</span>;
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

  return (
    <div className="chart-card">
      <h2>Survey Responses ({sorted.length} of {surveys.length})</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Filter by participant or UUID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle, minWidth: 220 }}
        />
        <button
          onClick={() => exportCSV(sorted, questionIds)}
          style={{ ...inputStyle, marginLeft: "auto", cursor: "pointer", color: "#374151" }}
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
              <th onClick={() => toggleSort("date")} style={{ cursor: "pointer" }}>Date<SortIcon k="date" /></th>
              {questionIds.map((qId) => (
                <th key={qId}>{qId}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, i) => {
              const answerMap = Object.fromEntries(
                s.responses.map((r) => [r.questionId, r.value])
              );
              return (
                <tr key={i}>
                  <td style={{ color: "#111827" }}>
                    {s.user_nickname || <span style={{ color: "#9ca3af" }}>—</span>}
                  </td>
                  <td>
                    <span title={s.user_uuid ?? ""} style={{ fontFamily: "monospace", fontSize: 11 }}>
                      {s.user_uuid ? `${s.user_uuid.slice(0, 8)}…` : <span style={{ color: "#9ca3af" }}>—</span>}
                    </span>
                  </td>
                  <td>{s.created_at.slice(0, 10)}</td>
                  {questionIds.map((qId) => {
                    const v = answerMap[qId];
                    return (
                      <td key={qId} style={{ fontVariantNumeric: "tabular-nums" }}>
                        {v !== undefined ? String(v) : <span style={{ color: "#9ca3af" }}>—</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {questionIds.length > 0 && (
        <p style={{ fontSize: 11, color: "#6b7280" }}>
          {questionIds.length} question{questionIds.length !== 1 ? "s" : ""} found across all responses.
          Hover a UUID cell to see the full identifier.
        </p>
      )}
    </div>
  );
}
