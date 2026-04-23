import { useState, useMemo } from "react";
import type { ParsedGameSession } from "../../loaders/loadData";
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
  joined: JoinedSessionSurvey[];
  trustQuestionId: string | null;
  surveyLoaded: boolean;
  boards: Map<number, RewardSurface>;
}

export function IndividualView({ sessions, joined, trustQuestionId, surveyLoaded, boards }: Props) {
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null);
  const [selectedSessionIndex, setSelectedSessionIndex] = useState<number>(1);

  const participants = useMemo(() => getParticipantList(sessions), [sessions]);

  const activeUuid = selectedUuid ?? participants[0]?.uuid ?? null;
  const activeTrustId = trustQuestionId ?? "";

  const timeline = useMemo(
    () => (activeUuid ? computeIndividualTimeline(joined, activeUuid, activeTrustId, boards) : []),
    [joined, activeUuid, activeTrustId, boards],
  );

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
          value={activeUuid ?? ""}
          onChange={(e) => { setSelectedUuid(e.target.value); setSelectedSessionIndex(1); }}
        >
          {participants.map(({ uuid, nickname }) => (
            <option key={uuid} value={uuid}>{nickname}</option>
          ))}
        </select>
        {!surveyLoaded && (
          <span style={{ fontSize: 12, color: "#475569" }}>
            Load survey CSV to see trust data.
          </span>
        )}
        {surveyLoaded && !trustQuestionId && (
          <span style={{ fontSize: 12, color: "#475569" }}>
            Select a trust question in Trust & Influence to overlay trust.
          </span>
        )}
      </div>

      {kpis && <ParticipantKpiCards kpis={kpis} />}

      <IndividualTimeline points={timeline} showTrust={hasTrust} />

      <ConditionExposure points={timeline} />

      <GameBreakdown
        points={timeline}
        selectedSessionIndex={selectedSessionIndex}
        onSelectSession={setSelectedSessionIndex}
      />

      {surveyLoaded && (
        <SurveyResponseTable userId={activeUuid ?? ""} joined={joined} points={timeline} />
      )}
    </div>
  );
}
