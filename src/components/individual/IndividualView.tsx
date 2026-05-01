import { useState, useMemo, useCallback, useEffect } from "react";
import type { ParsedGameSession, ParsedSurveyResponse } from "../../loaders/loadData";
import type { RewardSurface } from "../../types/dart";
import type { JoinedSessionSurvey } from "../../utils/surveyStats";
import {
  getParticipantList,
  computeIndividualTimeline,
  computeIndividualKpis,
} from "../../utils/individualStats";
import { ParticipantKpiCards } from "./ParticipantKpiCards";
import { IndividualTimeline } from "./IndividualTimeline";
import { ConditionExposure } from "./ConditionExposure";
import { GameBreakdown } from "./GameBreakdown";
import { SurveyResponseTable } from "./SurveyResponseTable";

interface Props {
  sessions: ParsedGameSession[];
  surveys: ParsedSurveyResponse[];
  joined: JoinedSessionSurvey[];
  trustQuestionId: string | null;
  surveyLoaded: boolean;
  boards: Map<number, RewardSurface>;
  onNavigateToSession?: (participantUuid: string, globalSessionIndex: number) => void;
  filterUuids?: string[];
}

export function IndividualView({ sessions, surveys, joined, trustQuestionId, surveyLoaded, boards, onNavigateToSession, filterUuids }: Props) {
  const [selectedUuid, setSelectedUuid] = useState<string>(
    () => getParticipantList(sessions)[0]?.uuid ?? ""
  );
  const [selectedSessionIndex, setSelectedSessionIndex] = useState<number>(1);

  const participants = useMemo(() => {
    const all = getParticipantList(sessions);
    if (!filterUuids || filterUuids.length === 0) return all;
    const filterSet = new Set(filterUuids);
    return all.filter((p) => filterSet.has(p.uuid));
  }, [sessions, filterUuids]);

  // Derive the active UUID — if selectedUuid isn't in the (possibly filtered) list, fall back to first
  const effectiveUuid = useMemo(() => {
    if (participants.some((p) => p.uuid === selectedUuid)) return selectedUuid;
    return participants[0]?.uuid ?? "";
  }, [participants, selectedUuid]);

  // Reset session index whenever the active participant changes
  useEffect(() => {
    setSelectedSessionIndex(1);
  }, [effectiveUuid]);

  const activeUuid = effectiveUuid || null;
  const activeTrustId = trustQuestionId ?? "";

  const timeline = useMemo(
    () => (activeUuid ? computeIndividualTimeline(joined, activeUuid, activeTrustId, boards) : []),
    [joined, activeUuid, activeTrustId, boards],
  );

  const handleTimelinePointClick = useCallback((sessionIndex: number) => {
    if (!onNavigateToSession || !activeUuid) return;
    const participantSessions = sessions
      .map((s, i) => ({ session: s, globalIndex: i }))
      .filter(({ session }) => session.user_uuid === activeUuid);
    const entry = participantSessions[sessionIndex - 1];
    if (entry != null) onNavigateToSession(activeUuid, entry.globalIndex);
  }, [onNavigateToSession, activeUuid, sessions]);

  const kpis = useMemo(
    () => (activeUuid ? computeIndividualKpis(joined, activeUuid, activeTrustId, boards) : null),
    [joined, activeUuid, activeTrustId, boards],
  );

  if (participants.length === 0) {
    return <p className="section-note">No participants loaded.</p>;
  }

  const hasTrust = surveyLoaded && trustQuestionId !== null;

  return (
    <div className="individual-view">
      <div className="individual-selector-row">
        <label className="trust-selector__label" htmlFor="participant-select">Participant</label>
        <select
          id="participant-select"
          className="trust-selector__select"
          value={effectiveUuid}
          onChange={(e) => { setSelectedUuid(e.target.value); setSelectedSessionIndex(1); }}
        >
          {participants.map(({ uuid, nickname }) => (
            <option key={uuid} value={uuid}>{nickname}</option>
          ))}
        </select>
        {!surveyLoaded && (
          <span style={{ fontSize: 12, color: "#6b7280" }}>
            Load survey CSV to see trust data.
          </span>
        )}
        {surveyLoaded && !trustQuestionId && (
          <span style={{ fontSize: 12, color: "#6b7280" }}>
            Select a trust question in Trust & Influence to overlay trust.
          </span>
        )}
      </div>

      {kpis && <ParticipantKpiCards kpis={kpis} />}

      <IndividualTimeline points={timeline} showTrust={hasTrust} onPointClick={handleTimelinePointClick} />

      <ConditionExposure points={timeline} />

      <GameBreakdown
        points={timeline}
        selectedSessionIndex={selectedSessionIndex}
        onSelectSession={setSelectedSessionIndex}
      />

      {surveyLoaded && (
        <SurveyResponseTable userId={activeUuid ?? ""} surveys={surveys} sessions={sessions} />
      )}
    </div>
  );
}
