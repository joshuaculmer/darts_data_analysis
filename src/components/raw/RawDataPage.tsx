import type { ParsedGameSession, ParsedSurveyResponse } from "../../loaders/loadData";
import type { RewardSurface } from "../../types/dart";
import type { EvGrids } from "../../loaders/loadEvGrids";
import type { SessionVariableRow } from "../../utils/variables";
import { SessionsTable } from "./SessionsTable";
import { GameDataTable } from "./GameDataTable";
import { SurveyTable } from "./SurveyTable";

interface Props {
  sessions: ParsedGameSession[];
  surveys: ParsedSurveyResponse[];
  boards: Map<number, RewardSurface>;
  evGrids: EvGrids;
  /** App's precomputed variable rows, aligned by index with `sessions`. */
  variableRows: SessionVariableRow[];
  completeOnly: boolean;
  onToggleCompleteOnly: () => void;
}

/**
 * Raw Data page. The three tables build their full row sets synchronously
 * (scores, dispersion, EV gaps for every session). Navigating here no longer
 * freezes because `RouteSpinnerGate` in App.tsx paints the spinner before this
 * page mounts, so the build runs behind an already-visible spinner. The tables
 * themselves virtualize their rows so only the visible ~30 hit the DOM.
 */
export function RawDataPage({
  sessions,
  surveys,
  boards,
  evGrids,
  variableRows,
  completeOnly,
  onToggleCompleteOnly,
}: Props) {
  return (
    <section className="dash-section">
      <div className="raw-toolbar">
        <p className="section-note" style={{ margin: 0 }}>
          Sessions and survey responses. Click any column header to sort.
        </p>
        <label className="kpi-toggle">
          <input
            type="checkbox"
            checked={completeOnly}
            onChange={onToggleCompleteOnly}
          />
          <span className="kpi-toggle__label">Complete participants only</span>
        </label>
      </div>
      <SessionsTable sessions={sessions} surveys={surveys} boards={boards} evGrids={evGrids} variableRows={variableRows} />
      <GameDataTable sessions={sessions} />
      <SurveyTable surveys={surveys} />
    </section>
  );
}
