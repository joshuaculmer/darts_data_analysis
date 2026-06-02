import { useMemo } from "react";
import type { JoinedSessionSurvey } from "../../utils/surveyStats";
import type { CorrelationCell } from "../../utils/correlation";
import { computeVariableByCondition, VARIABLES, VARIABLE_KEYS } from "../../utils/variables";
import type { SessionVariableRow } from "../../utils/variables";
import { SurveyDimensionCharts } from "../correlation/SurveyDimensionCharts";
import { VariableByCondition } from "../correlation/VariableByCondition";
import { PairwiseScatter } from "../correlation/PairwiseScatter";
import { GlobalHeatmapSection } from "../correlation/GlobalHeatmapSection";

interface Props {
  joined: JoinedSessionSurvey[];
  variableRows: SessionVariableRow[];
  matrix: CorrelationCell[][];
}

export function PerformanceGroup({ joined, variableRows, matrix }: Props) {
  const scoreByCondition = useMemo(
    () => computeVariableByCondition(variableRows, "scorePerHit"),
    [variableRows],
  );
  const proxOptimalByCondition = useMemo(
    () => computeVariableByCondition(variableRows, "proxOptimal"),
    [variableRows],
  );

  return (
    <section className="dash-section">
      <p className="section-note">
        Objective performance (per-hit score, distance from the optimal aim) and how satisfied players
        felt with where they chose to aim. Score is normalized per hit so the dynamic hit count
        (1/3/5/10 throws per game) does not confound it.
      </p>

      <VariableByCondition
        stats={scoreByCondition}
        title="Mean Score per Hit by AI Condition"
        valueLabel={VARIABLES.scorePerHit.label}
        format={VARIABLES.scorePerHit.format}
      />

      <SurveyDimensionCharts joined={joined} questionId="satisfied" />

      <VariableByCondition
        stats={proxOptimalByCondition}
        title="Mean Proximity to Optimal Aim by Condition"
        valueLabel={VARIABLES.proxOptimal.label}
        format={VARIABLES.proxOptimal.format}
      />

      <PairwiseScatter rows={variableRows} xKey="satisfied" yKey="scorePerHit" />
      <PairwiseScatter rows={variableRows} xKey="satisfied" yKey="proxOptimal" />
      <PairwiseScatter rows={variableRows} xKey="proxOptimal" yKey="scorePerHit" />

      <GlobalHeatmapSection matrix={matrix} keys={VARIABLE_KEYS} rows={variableRows} highlightGroup="performance" />
    </section>
  );
}
