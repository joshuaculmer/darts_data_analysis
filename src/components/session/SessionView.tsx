import { useState, useEffect } from "react";
import type { ParsedGameSession } from "../../loaders/loadData";
import type { RewardSurface } from "../../types/dart";
import { computeSessionScore, gameScore } from "../../utils/scoreStats";
import { AI_TYPE_LABELS } from "../../utils/stats";

interface Props {
  sessions: ParsedGameSession[];
  boards: Map<number, RewardSurface>;
  initialParticipant?: string | null;
  initialSessionIndex?: number | null;
}

export function SessionView({ sessions, boards, initialParticipant, initialSessionIndex }: Props) {
  const participantIds = [...new Set(sessions.map((s) => s.user_uuid))].sort();

  const [selectedParticipant, setSelectedParticipant] = useState<string>(
    initialParticipant ?? participantIds[0] ?? ""
  );
  const [selectedSessionIndex, setSelectedSessionIndex] = useState<number | null>(0);
  const [expandedGame, setExpandedGame] = useState<number | null>(null);

  const participantSessions = sessions
    .map((s, i) => ({ session: s, globalIndex: i }))
    .filter(({ session }) => session.user_uuid === selectedParticipant);

  // Apply initial selection from click-to-navigate
  useEffect(() => {
    if (initialParticipant) setSelectedParticipant(initialParticipant);
  }, [initialParticipant]);

  useEffect(() => {
    if (initialSessionIndex != null) {
      const localIdx = participantSessions.findIndex(
        ({ globalIndex }) => globalIndex === initialSessionIndex
      );
      setSelectedSessionIndex(localIdx >= 0 ? localIdx : 0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSessionIndex, initialParticipant]);

  // Reset session selection when participant changes (unless driven by initialSessionIndex)
  useEffect(() => {
    setSelectedSessionIndex(null);
    setExpandedGame(null);
  }, [selectedParticipant]);

  const activeEntry = selectedSessionIndex != null ? participantSessions[selectedSessionIndex] : null;
  const activeSession = activeEntry?.session ?? null;

  const sessionScore = activeSession ? computeSessionScore(activeSession, boards) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Selectors */}
      <div className="chart-card" style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, color: "#94a3b8" }}>Participant</label>
          <select
            value={selectedParticipant}
            onChange={(e) => setSelectedParticipant(e.target.value)}
            style={{ background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 4, padding: "4px 8px", fontSize: 13 }}
          >
            {participantIds.map((id) => {
              const nick = sessions.find((s) => s.user_uuid === id)?.user_nickname;
              return (
                <option key={id} value={id}>
                  {nick ? `${nick} (${id.slice(0, 8)}…)` : id.slice(0, 12) + "…"}
                </option>
              );
            })}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, color: "#94a3b8" }}>Session</label>
          <select
            value={selectedSessionIndex ?? ""}
            onChange={(e) => {
              setSelectedSessionIndex(Number(e.target.value));
              setExpandedGame(null);
            }}
            style={{ background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 4, padding: "4px 8px", fontSize: 13 }}
          >
            {participantSessions.map(({ session }, localIdx) => (
              <option key={localIdx} value={localIdx}>
                Session {localIdx + 1} — {AI_TYPE_LABELS[session.ai_advice]} — {new Date(session.created_at).toLocaleDateString()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Session metadata */}
      {activeSession && sessionScore && (
        <div className="chart-card">
          <h2 style={{ marginBottom: 12 }}>Session Metadata</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <tbody>
              {[
                ["Participant UUID", activeSession.user_uuid],
                ["Nickname", activeSession.user_nickname ?? "—"],
                ["Created At", new Date(activeSession.created_at).toLocaleString()],
                ["AI Condition", `${AI_TYPE_LABELS[activeSession.ai_advice]} (${activeSession.ai_advice})`],
                ["Execution Skill", activeSession.execution_skill],
                ["Games Played", activeSession.games_played],
                ["Total Score", sessionScore.sum.toFixed(2)],
                ["Avg Score / Game", sessionScore.avg.toFixed(2)],
              ].map(([label, value]) => (
                <tr key={label as string} style={{ borderBottom: "1px solid #1e293b" }}>
                  <td style={{ padding: "6px 12px 6px 0", color: "#94a3b8", fontWeight: 500, whiteSpace: "nowrap" }}>{label}</td>
                  <td style={{ padding: "6px 0", color: "#e2e8f0" }}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Games table */}
      {activeSession && sessionScore && (
        <div className="chart-card">
          <h2 style={{ marginBottom: 12 }}>Games</h2>
          <p style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>
            Click a row to expand / collapse its hit coordinates.
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #334155" }}>
                {["#", "Board ID", "Score", "# Hits", "Actual Aim (x, y)", "Suggested Aim (x, y)", "Start", "End"].map((h) => (
                  <th key={h} style={{ padding: "6px 10px", textAlign: "left", color: "#94a3b8", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeSession.games.map((game, gi) => {
                const surface = boards.get(game.board_id);
                const score = surface ? gameScore(game, surface) : null;
                const isExpanded = expandedGame === gi;
                return (
                  <>
                    <tr
                      key={`game-${gi}`}
                      onClick={() => setExpandedGame(isExpanded ? null : gi)}
                      style={{
                        borderBottom: "1px solid #1e293b",
                        cursor: "pointer",
                        background: isExpanded ? "#1e3a5f22" : undefined,
                      }}
                    >
                      <td style={{ padding: "6px 10px", color: "#e2e8f0" }}>{gi + 1}</td>
                      <td style={{ padding: "6px 10px", color: "#e2e8f0" }}>{game.board_id}</td>
                      <td style={{ padding: "6px 10px", color: "#e2e8f0" }}>
                        {score != null ? score.toFixed(2) : <span style={{ color: "#475569" }}>—</span>}
                      </td>
                      <td style={{ padding: "6px 10px", color: "#e2e8f0" }}>{game.hits.length}</td>
                      <td style={{ padding: "6px 10px", color: "#e2e8f0" }}>
                        ({game.actual_aiming_coord.x.toFixed(2)}, {game.actual_aiming_coord.y.toFixed(2)})
                      </td>
                      <td style={{ padding: "6px 10px", color: "#e2e8f0" }}>
                        {game.suggested_aiming_coord
                          ? `(${game.suggested_aiming_coord.x.toFixed(2)}, ${game.suggested_aiming_coord.y.toFixed(2)})`
                          : <span style={{ color: "#475569" }}>—</span>}
                      </td>
                      <td style={{ padding: "6px 10px", color: "#64748b" }}>{game.start}</td>
                      <td style={{ padding: "6px 10px", color: "#64748b" }}>{game.end}</td>
                    </tr>
                    {isExpanded && (
                      <tr key={`hits-${gi}`}>
                        <td colSpan={8} style={{ padding: "0 10px 12px 32px", background: "#0f172a" }}>
                          <div style={{ paddingTop: 8 }}>
                            <p style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>
                              Hit coordinates ({game.hits.length} hits)
                            </p>
                            {game.hits.length === 0 ? (
                              <span style={{ fontSize: 12, color: "#475569" }}>No hits recorded.</span>
                            ) : (
                              <table style={{ borderCollapse: "collapse", fontSize: 11 }}>
                                <thead>
                                  <tr>
                                    <th style={{ padding: "4px 12px 4px 0", color: "#64748b", textAlign: "left" }}>Hit #</th>
                                    <th style={{ padding: "4px 12px 4px 0", color: "#64748b", textAlign: "left" }}>x</th>
                                    <th style={{ padding: "4px 12px 4px 0", color: "#64748b", textAlign: "left" }}>y</th>
                                    <th style={{ padding: "4px 12px 4px 0", color: "#64748b", textAlign: "left" }}>Score</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {game.hits.map((hit, hi) => {
                                    const hx = Math.floor(hit.x);
                                    const hy = Math.floor(hit.y);
                                    const hitScore = surface ? (surface[hx]?.[hy] ?? 0) : null;
                                    return (
                                      <tr key={hi} style={{ borderBottom: "1px solid #1e293b" }}>
                                        <td style={{ padding: "3px 12px 3px 0", color: "#94a3b8" }}>{hi + 1}</td>
                                        <td style={{ padding: "3px 12px 3px 0", color: "#e2e8f0" }}>{hit.x.toFixed(4)}</td>
                                        <td style={{ padding: "3px 12px 3px 0", color: "#e2e8f0" }}>{hit.y.toFixed(4)}</td>
                                        <td style={{ padding: "3px 12px 3px 0", color: "#e2e8f0" }}>
                                          {hitScore != null ? hitScore.toFixed(4) : "—"}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!activeSession && (
        <div className="chart-card">
          <p style={{ color: "#475569", fontSize: 13 }}>No sessions found for this participant.</p>
        </div>
      )}
    </div>
  );
}
