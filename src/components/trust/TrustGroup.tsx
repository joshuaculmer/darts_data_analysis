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

export function TrustGroup({ joined, variableRows, matrix }: Props) {
  const proxAIByCondition = useMemo(
    () => computeVariableByCondition(variableRows, "proxAI"),
    [variableRows],
  );

  return (
    <section className="dash-section">
      <p className="section-note">
        Trust and influence ratings, how condition shaped them, and how they relate to how closely
        players followed the AI's suggestion (proximity to AI).
      </p>

      <SurveyDimensionCharts joined={joined} questionId="trust" />
      <SurveyDimensionCharts joined={joined} questionId="influence" />

      <VariableByCondition
        stats={proxAIByCondition}
        title="Mean Proximity to AI Suggestion by Condition"
        valueLabel={VARIABLES.proxAI.label}
        format={VARIABLES.proxAI.format}
      />

      <PairwiseScatter rows={variableRows} xKey="trust" yKey="influence" />
      <PairwiseScatter rows={variableRows} xKey="trust" yKey="proxAI" />
      <PairwiseScatter rows={variableRows} xKey="influence" yKey="proxAI" />

      <GlobalHeatmapSection matrix={matrix} keys={VARIABLE_KEYS} rows={variableRows} highlightGroup="trust" />
    </section>
  );
}
