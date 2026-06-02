import { useState } from "react";
import type { CorrelationCell } from "../../utils/correlation";
import type { SessionVariableRow, VariableKey } from "../../utils/variables";
import type { VariableGroup } from "../../utils/surveyScales";
import { CorrelationHeatmap } from "./CorrelationHeatmap";
import { PairwiseScatter } from "./PairwiseScatter";

interface Props {
  matrix: CorrelationCell[][];
  keys: VariableKey[];
  rows: SessionVariableRow[];
  highlightGroup?: VariableGroup;
}

/**
 * The global cross-correlation heatmap plus its click-to-scatter drilldown.
 * Clicking an off-diagonal cell opens a pairwise scatter of those two variables.
 */
export function GlobalHeatmapSection({ matrix, keys, rows, highlightGroup }: Props) {
  const [pair, setPair] = useState<[VariableKey, VariableKey] | null>(null);

  return (
    <>
      <CorrelationHeatmap
        matrix={matrix}
        keys={keys}
        highlightGroup={highlightGroup}
        onCellClick={(i, j) => setPair(i === j ? null : [i, j])}
      />
      {pair && <PairwiseScatter rows={rows} xKey={pair[0]} yKey={pair[1]} />}
    </>
  );
}
