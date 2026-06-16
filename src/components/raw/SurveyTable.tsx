// All colors in this file must follow PALETTE.md at the project root.
import { useState, useMemo } from "react";
import type { ParsedSurveyResponse } from "../../loaders/loadData";
import { useDebouncedValue } from "../../utils/useDebouncedValue";
import { RawTableCard } from "./RawTableCard";
import { VirtualizedTable } from "./VirtualizedTable";
import type { VirtualColumn } from "./VirtualizedTable";

interface Props {
  surveys: ParsedSurveyResponse[];
}

type SortDir = "asc" | "desc";
type SortCol = "participant" | "uuid" | "date";

const cmpStr = (a: string, b: string, dir: SortDir) =>
  dir === "asc" ? a.localeCompare(b) : b.localeCompare(a);

/**
 * Sorts survey rows by the chosen column, with `created_at` (the only timestamp
 * a survey carries) as a universal tiebreaker that is ALWAYS ascending,
 * regardless of the primary direction. This makes the ordering intentional, not
 * incidental: the default (participant) groups each participant's responses
 * chronologically, and any column sort still falls back to chronological order
 * for equal values. UUID is the final tiebreaker for full determinism. Pure +
 * exported so it can be unit-tested.
 */
export function sortSurveyRows(
  rows: ParsedSurveyResponse[],
  col: SortCol,
  dir: SortDir,
): ParsedSurveyResponse[] {
  return [...rows].sort((a, b) => {
    let primary = 0;
    if (col === "participant") {
      primary = cmpStr(a.user_nickname || (a.user_uuid ?? ""), b.user_nickname || (b.user_uuid ?? ""), dir);
      if (primary === 0) primary = cmpStr(a.user_uuid ?? "", b.user_uuid ?? "", dir);
    } else if (col === "uuid") {
      primary = cmpStr(a.user_uuid ?? "", b.user_uuid ?? "", dir);
    } else {
      primary = cmpStr(a.created_at, b.created_at, dir);
    }
    if (primary !== 0) return primary;
    const chrono = a.created_at.localeCompare(b.created_at);
    if (chrono !== 0) return chrono;
    return (a.user_uuid ?? "").localeCompare(b.user_uuid ?? "");
  });
}

function exportCSV(rows: ParsedSurveyResponse[], questionIds: string[]) {
  const headers = ["participant", "user_uuid", "date", ...questionIds];
  // Export in the current on-screen order (participant → chronological by
  // default), so the CSV matches the intentional ordering shown in the table.
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
  // Default to the intentional ordering: participant, then chronological
  // (created_at ascending) within each participant — see sortSurveyRows.
  const [sortCol, setSortCol] = useState<SortCol>("participant");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const questionIds = useMemo(
    () =>
      Array.from(new Set(surveys.flatMap((s) => s.responses.map((r) => r.questionId)))).sort(),
    [surveys]
  );

  const debouncedSearch = useDebouncedValue(search);
  const filtered = useMemo(() => {
    if (!debouncedSearch.trim()) return surveys;
    const q = debouncedSearch.trim().toLowerCase();
    return surveys.filter(
      (s) =>
        (s.user_nickname ?? "").toLowerCase().includes(q) ||
        (s.user_uuid ?? "").toLowerCase().includes(q)
    );
  }, [surveys, debouncedSearch]);

  const sorted = useMemo(
    () => sortSurveyRows(filtered, sortCol, sortDir),
    [filtered, sortCol, sortDir],
  );

  function toggleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }

  function sortIcon(k: SortCol) {
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

  type DisplayRow = { survey: ParsedSurveyResponse; answers: Record<string, unknown> };
  const displayRows = useMemo<DisplayRow[]>(
    () =>
      sorted.map((s) => ({
        survey: s,
        answers: Object.fromEntries(s.responses.map((r) => [r.questionId, r.value])),
      })),
    [sorted],
  );

  const columns: VirtualColumn<DisplayRow>[] = [
    {
      key: "participant",
      header: <>Participant{sortIcon("participant")}</>,
      width: 150,
      ellipsis: true,
      onHeaderClick: () => toggleSort("participant"),
      cell: ({ survey }) =>
        survey.user_nickname || <span style={{ color: "#9ca3af" }}>—</span>,
    },
    {
      key: "uuid",
      header: <>UUID{sortIcon("uuid")}</>,
      width: 130,
      onHeaderClick: () => toggleSort("uuid"),
      cell: ({ survey }) => (
        <span title={survey.user_uuid ?? ""} style={{ fontFamily: "monospace", fontSize: 11 }}>
          {survey.user_uuid ? `${survey.user_uuid.slice(0, 8)}…` : <span style={{ color: "#9ca3af" }}>—</span>}
        </span>
      ),
    },
    {
      key: "date",
      header: <>Date{sortIcon("date")}</>,
      width: 120,
      onHeaderClick: () => toggleSort("date"),
      cell: ({ survey }) => survey.created_at.slice(0, 10),
    },
    ...questionIds.map(
      (qId): VirtualColumn<DisplayRow> => ({
        key: `q:${qId}`,
        header: qId,
        width: 110,
        numeric: true,
        align: "left",
        cell: ({ answers }) => {
          const v = answers[qId];
          return v !== undefined ? String(v) : <span style={{ color: "#9ca3af" }}>—</span>;
        },
      }),
    ),
  ];

  return (
    <RawTableCard title={`Survey Responses (${sorted.length} of ${surveys.length})`}>
      <p className="raw-schema">
        One row per survey submission. CSV columns: <code>participant</code>,{" "}
        <code>user_uuid</code>, <code>date</code>, then one column per survey{" "}
        <code>questionId</code> holding that response's value (blank when the participant did not
        answer that question).
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
          onClick={() => exportCSV(sorted, questionIds)}
          style={{ ...inputStyle, marginLeft: "auto", cursor: "pointer", color: "#374151" }}
        >
          Export CSV
        </button>
      </div>

      <VirtualizedTable columns={columns} rows={displayRows} rowKey={(_r, i) => i} />
      {questionIds.length > 0 && (
        <p style={{ fontSize: 11, color: "#6b7280" }}>
          {questionIds.length} question{questionIds.length !== 1 ? "s" : ""} found across all responses.
          Hover a UUID cell to see the full identifier.
        </p>
      )}
    </RawTableCard>
  );
}
