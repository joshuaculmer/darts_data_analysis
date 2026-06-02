// All colors in this file must follow PALETTE.md at the project root.
import type { CorrelationCell } from "../../utils/correlation";
import { VARIABLES, type VariableKey } from "../../utils/variables";
import type { VariableGroup } from "../../utils/surveyScales";
import { ChartCard } from "../ChartCard";

interface Props {
  matrix: CorrelationCell[][];
  keys: VariableKey[];
  /** Highlight the row/column labels belonging to this group. */
  highlightGroup?: VariableGroup;
  onCellClick?: (keyI: VariableKey, keyJ: VariableKey) => void;
  title?: string;
}

// Diverging scale endpoints (PALETTE.md): negative=vermillion, zero=neutral, positive=teal.
const NEG = [0xd5, 0x5e, 0x00];
const MID = [0x9c, 0xa3, 0xaf];
const POS = [0x00, 0x9e, 0x73];

function lerp(a: number[], b: number[], t: number): string {
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

function cellColor(r: number | null): string {
  if (r === null) return "#f9fafb"; // --bg-muted, no coefficient
  const clamped = Math.max(-1, Math.min(1, r));
  return clamped < 0 ? lerp(MID, NEG, -clamped) : lerp(MID, POS, clamped);
}

export function CorrelationHeatmap({ matrix, keys, highlightGroup, onCellClick, title = "Variable Cross-Correlation (Spearman)" }: Props) {
  const labelColor = (k: VariableKey) =>
    highlightGroup && VARIABLES[k].group === highlightGroup ? "#111827" : "#6b7280";
  const labelWeight = (k: VariableKey) =>
    highlightGroup && VARIABLES[k].group === highlightGroup ? 700 : 500;

  const cellPx = 46;
  const labelPx = 96;

  return (
    <ChartCard title={title}>
      <div style={{ overflowX: "auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `${labelPx}px repeat(${keys.length}, ${cellPx}px)`,
            gap: 2,
            fontSize: 11,
          }}
        >
          {/* Header row */}
          <div />
          {keys.map((k) => (
            <div
              key={`h-${k}`}
              title={VARIABLES[k].label}
              style={{
                writingMode: "vertical-rl",
                transform: "rotate(180deg)",
                textAlign: "right",
                color: labelColor(k),
                fontWeight: labelWeight(k),
                height: labelPx,
                justifySelf: "center",
              }}
            >
              {VARIABLES[k].label}
            </div>
          ))}

          {/* Rows */}
          {matrix.map((rowCells, i) => {
            const rowKey = keys[i];
            return (
              <div key={`row-${rowKey}`} style={{ display: "contents" }}>
                <div
                  style={{
                    color: labelColor(rowKey),
                    fontWeight: labelWeight(rowKey),
                    textAlign: "right",
                    alignSelf: "center",
                    paddingRight: 6,
                  }}
                >
                  {VARIABLES[rowKey].label}
                </div>
                {rowCells.map((cell, j) => {
                  const isDiag = i === j;
                  const text = cell.r === null ? "" : cell.r.toFixed(2);
                  const strong = cell.r !== null && Math.abs(cell.r) >= 0.5;
                  return (
                    <button
                      key={`c-${i}-${j}`}
                      type="button"
                      onClick={() => onCellClick?.(cell.keyI, cell.keyJ)}
                      title={`${VARIABLES[cell.keyI].label} × ${VARIABLES[cell.keyJ].label}\nr = ${cell.r === null ? "n/a" : cell.r.toFixed(3)}, n = ${cell.n}`}
                      style={{
                        width: cellPx,
                        height: cellPx,
                        background: cellColor(cell.r),
                        border: isDiag ? "1px solid #111827" : "1px solid #e5e7eb",
                        borderRadius: 4,
                        color: strong ? "#ffffff" : "#111827",
                        fontSize: 11,
                        cursor: onCellClick ? "pointer" : "default",
                        fontFamily: "inherit",
                        padding: 0,
                      }}
                    >
                      {text}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <p style={{ fontSize: 11, color: "#6b7280", marginTop: 8 }}>
        Spearman rank correlation, pairwise-complete (hover a cell for r and n). Vermillion = negative,
        teal = positive, grey = no monotonic relation; blank = too few paired observations.
        {onCellClick ? " Click a cell to scatter the two variables." : ""}
      </p>
    </ChartCard>
  );
}
