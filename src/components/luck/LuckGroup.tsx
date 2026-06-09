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

export function LuckGroup({ joined, variableRows, matrix }: Props) {
  const dispersionByCondition = useMemo(
    () => computeVariableByCondition(variableRows, "dispersion"),
    [variableRows],
  );
  const evGapByCondition = useMemo(
    () => computeVariableByCondition(variableRows, "evGap"),
    [variableRows],
  );

  return (
    <section className="dash-section">
      <p className="section-note">
        How much players attributed their score to luck, how tightly their throws clustered (hit
        dispersion), and the gap between realized and expected score (EV gap).
      </p>

      <SurveyDimensionCharts joined={joined} questionId="luck" />

      <VariableByCondition
        stats={dispersionByCondition}
        title="Mean Hit Dispersion by Condition"
        valueLabel={VARIABLES.dispersion.label}
        format={VARIABLES.dispersion.format}
      />

      <VariableByCondition
        stats={evGapByCondition}
        title="Mean EV Gap by Condition"
        valueLabel={VARIABLES.evGap.label}
        format={VARIABLES.evGap.format}
      />

      <PairwiseScatter rows={variableRows} xKey="luck" yKey="dispersion" />
      <PairwiseScatter rows={variableRows} xKey="luck" yKey="evGap" />
      <PairwiseScatter rows={variableRows} xKey="dispersion" yKey="evGap" />

      <GlobalHeatmapSection matrix={matrix} keys={VARIABLE_KEYS} rows={variableRows} highlightGroup="luck" />
    </section>
  );
}
