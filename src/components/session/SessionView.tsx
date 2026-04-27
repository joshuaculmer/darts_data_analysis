import { useState, useEffect } from "react";
import type { ParsedGameSession } from "../../loaders/loadData";
import type { RewardSurface } from "../../types/dart";
import { computeSessionScore } from "../../utils/scoreStats";
import { AI_TYPE_LABELS, AI_TYPE_COLORS } from "../../utils/stats";
import { GameBoardView } from "./GameBoardView";

interface Props {
  sessions: ParsedGameSession[];
  boards: Map<number, RewardSurface>;
  initialParticipant?: string | null;
  initialSessionIndex?: number | null;
}

function KpiChip({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <span style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </span>
      <span style={{ fontSize: 14, fontWeight: 600, color: accent ? "#f1f5f9" : "#94a3b8" }}>
        {value}
      </span>
    </div>
  );
}

export function SessionView({ sessions, boards, initialParticipant, initialSessionIndex }: Props) {
  const participantIds = [...new Set(sessions.map((s) => s.user_uuid))].filter(Boolean).sort();

  const [selectedParticipant, setSelectedParticipant] = useState<string>(
    initialParticipant ?? participantIds[0] ?? ""
  );
  const [selectedSessionIndex, setSelectedSessionIndex] = useState<number>(0);
  const [selectedGame, setSelectedGame] = useState<number>(0);

  const participantSessions = sessions
    .map((s, i) => ({ session: s, globalIndex: i }))
    .filter(({ session }) => session.user_uuid === selectedParticipant);

  // Handle click-to-navigate from scatter plot.
  // Compute local index using initialParticipant directly so both states
  // are set atomically — avoids a race where participant-change resets session index.
  useEffect(() => {
    if (initialParticipant == null || initialSessionIndex == null) return;
    const navSessions = sessions
      .map((s, i) => ({ session: s, globalIndex: i }))
      .filter(({ session }) => session.user_uuid === initialParticipant);
    const localIdx = navSessions.findIndex(({ globalIndex }) => globalIndex === initialSessionIndex);
    setSelectedParticipant(initialParticipant);
    setSelectedSessionIndex(localIdx >= 0 ? localIdx : 0);
    setSelectedGame(0);
  // sessions is stable across navigations; initialParticipant/Index are the triggers
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialParticipant, initialSessionIndex]);

  // Reset selected game when session changes
  useEffect(() => {
    setSelectedGame(0);
  }, [selectedSessionIndex, selectedParticipant]);

  const activeEntry = participantSessions[selectedSessionIndex] ?? null;
  const activeSession = activeEntry?.session ?? null;
  const sessionScore = activeSession ? computeSessionScore(activeSession, boards) : null;

  const game = activeSession?.games[selectedGame] ?? null;
  const surface = game ? (boards.get(game.board_id) ?? null) : null;
  const maxGameScore = sessionScore ? Math.max(...sessionScore.gameScores, 1) : 1;

  return (
    <div style={{
      border: "1px solid #334155",
      borderRadius: 10,
      overflow: "hidden",
      background: "#0f172a",
    }}>

      {/* Zone 1: Navigation strip — participant + session pills */}
      <div style={{
        background: "#1e293b",
        borderBottom: "1px solid #334155",
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        flexWrap: "wrap",
      }}>
        <select
          value={selectedParticipant}
          onChange={(e) => {
            setSelectedParticipant(e.target.value);
            setSelectedSessionIndex(0);
          }}
          style={{
            background: "#0f172a",
            color: "#e2e8f0",
            border: "1px solid #475569",
            borderRadius: 6,
            padding: "5px 10px",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          {participantIds.map((id) => {
            const nick = sessions.find((s) => s.user_uuid === id)?.user_nickname;
            return (
              <option key={id} value={id}>
                {nick ? `${nick} (${id?.slice(0, 8) ?? ""}…)` : (id?.slice(0, 12) ?? id) + "…"}
              </option>
            );
          })}
        </select>

        <span style={{ color: "#334155", userSelect: "none" }}>│</span>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {participantSessions.map(({ session }, localIdx) => {
            const color = AI_TYPE_COLORS[session.ai_advice];
            const isActive = localIdx === selectedSessionIndex;
            return (
              <button
                key={localIdx}
                onClick={() => setSelectedSessionIndex(localIdx)}
                style={{
                  padding: "4px 11px",
                  border: `1.5px solid ${color}`,
                  borderRadius: 99,
                  background: isActive ? color : "transparent",
                  color: isActive ? "#0f172a" : color,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "background 0.12s, color 0.12s",
                }}
              >
                S{localIdx + 1} · {AI_TYPE_LABELS[session.ai_advice]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Zone 2: Session KPI strip */}
      {activeSession && sessionScore && (
        <div style={{
          background: "#111827",
          borderBottom: "1px solid #1e293b",
          padding: "10px 18px",
          display: "flex",
          alignItems: "center",
          gap: 28,
          flexWrap: "wrap",
        }}>
          <span
            className="condition-badge"
            style={{
              background: AI_TYPE_COLORS[activeSession.ai_advice],
              fontSize: 12,
              padding: "3px 11px",
              fontWeight: 700,
            }}
          >
            {AI_TYPE_LABELS[activeSession.ai_advice]}
          </span>

          <KpiChip label="Date" value={new Date(activeSession.created_at).toLocaleDateString()} />
          <KpiChip label="Skill" value={activeSession.execution_skill} />
          <KpiChip label="Games" value={activeSession.games.length} />
          <KpiChip label="Total Score" value={sessionScore.sum.toFixed(1)} accent />
          <KpiChip label="Avg / Game" value={sessionScore.avg.toFixed(1)} accent />

          <span style={{ marginLeft: "auto", fontSize: 10, color: "#334155", fontFamily: "monospace" }}>
            {activeSession.user_uuid}
          </span>
        </div>
      )}

      {/* Zone 3: Game list + game detail */}
      {activeSession && sessionScore ? (
        <div style={{ display: "flex", minHeight: 620 }}>

          {/* Left panel: game list */}
          <div style={{
            width: 196,
            flexShrink: 0,
            borderRight: "1px solid #1e293b",
            background: "#0a1120",
            overflowY: "auto",
            paddingTop: 4,
            paddingBottom: 4,
          }}>
            {activeSession.games.map((g, gi) => {
              const gScore = sessionScore.gameScores[gi];
              const isSelected = gi === selectedGame;
              const barPct = Math.round((gScore / maxGameScore) * 100);
              return (
                <button
                  key={gi}
                  onClick={() => setSelectedGame(gi)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    background: isSelected ? "#1e293b" : "transparent",
                    border: "none",
                    borderLeft: `3px solid ${isSelected ? "#4f8ef7" : "transparent"}`,
                    padding: "10px 12px",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: 5,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontSize: 13, fontWeight: isSelected ? 600 : 400, color: isSelected ? "#f1f5f9" : "#94a3b8" }}>
                      Game {gi + 1}
                    </span>
                    <span style={{ fontSize: 12, color: isSelected ? "#e2e8f0" : "#64748b", fontVariantNumeric: "tabular-nums" }}>
                      {gScore.toFixed(1)}
                    </span>
                  </div>
                  <div style={{ height: 3, background: "#1e293b", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${barPct}%`,
                      background: isSelected ? "#4f8ef7" : "#334155",
                      borderRadius: 2,
                    }} />
                  </div>
                  <span style={{ fontSize: 10, color: "#475569" }}>
                    {g.hits.length} hits · board {g.board_id}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right panel: game detail */}
          <div style={{ flex: 1, display: "flex", flexDirection: "row", overflow: "auto" }}>
            {game ? (
              <>
                {/* Board canvas */}
                <div style={{ padding: 20, flexShrink: 0, borderRight: "1px solid #1e293b" }}>
                  {surface ? (
                    <GameBoardView game={game} surface={surface} />
                  ) : (
                    <p style={{ color: "#475569", fontSize: 13 }}>Board surface not loaded.</p>
                  )}
                </div>

                {/* Hit table */}
                <div style={{ padding: "14px 20px", overflowY: "auto" }}>
                  <p style={{ fontSize: 11, color: "#64748b", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Hit coordinates — {game.hits.length} hits
                  </p>
                  {game.hits.length === 0 ? (
                    <span style={{ fontSize: 13, color: "#475569" }}>No hits recorded.</span>
                  ) : (
                    <table style={{ borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr>
                          {["Hit #", "x", "y", "Score"].map((h) => (
                            <th key={h} style={{ padding: "4px 20px 6px 0", color: "#64748b", textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500 }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {game.hits.map((hit, hi) => {
                          const hx = Math.floor(hit.x);
                          const hy = Math.floor(hit.y);
                          const hitScore = surface ? (surface[hx]?.[hy] ?? 0) : null;
                          return (
                            <tr key={hi} style={{ borderBottom: "1px solid #1e293b" }}>
                              <td style={{ padding: "4px 20px 4px 0", color: "#475569" }}>{hi + 1}</td>
                              <td style={{ padding: "4px 20px 4px 0", color: "#e2e8f0", fontFamily: "monospace" }}>{hit.x.toFixed(3)}</td>
                              <td style={{ padding: "4px 20px 4px 0", color: "#e2e8f0", fontFamily: "monospace" }}>{hit.y.toFixed(3)}</td>
                              <td style={{ padding: "4px 0", color: hitScore ? "#f1f5f9" : "#475569" }}>
                                {hitScore != null ? hitScore : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            ) : (
              <div style={{ padding: 24 }}>
                <p style={{ color: "#475569", fontSize: 13 }}>No games in this session.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ padding: 24 }}>
          <p style={{ color: "#475569", fontSize: 13 }}>No sessions found for this participant.</p>
        </div>
      )}
    </div>
  );
}
