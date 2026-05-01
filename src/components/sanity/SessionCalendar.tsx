import { useMemo, useRef, useState } from "react";
import { groupParticipantsByDate } from "../../utils/stats";
import type { ParsedGameSession } from "../../loaders/loadData";
import { ChartCard } from "../ChartCard";

const CELL = 13;
const GAP = 2;
const STEP = CELL + GAP;
const DAY_COL = 32;
const MONTH_ROW = 20;

const COLOR_SCALE = ["#ebedf0", "#bfdbfe", "#60a5fa", "#2563eb", "#1e40af"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SHOW_DAY_LABEL = [false, true, false, true, false, true, false];

function dayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + n);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function monthLabel(dateStr: string): string {
  const [y, m] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short" });
}

function cellColor(count: number, max: number): string {
  if (count === 0) return COLOR_SCALE[0];
  const ratio = max > 1 ? count / max : 1;
  if (ratio <= 0.25) return COLOR_SCALE[1];
  if (ratio <= 0.5) return COLOR_SCALE[2];
  if (ratio <= 0.75) return COLOR_SCALE[3];
  return COLOR_SCALE[4];
}

interface TooltipState {
  date: string;
  count: number;
  x: number;
  y: number;
}

interface Props {
  sessions: ParsedGameSession[];
  onDayClick?: (uuids: string[]) => void;
}

export function SessionCalendar({ sessions, onDayClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const { cells, numWeeks, monthLabels, maxCount, uuidsMap } = useMemo(() => {
    if (sessions.length === 0) {
      return { cells: [], numWeeks: 0, monthLabels: [], maxCount: 0, uuidsMap: new Map<string, string[]>() };
    }

    const byDate = groupParticipantsByDate(sessions);
    const countMap = new Map(byDate.map((d) => [d.date, d.count]));
    const uuidsMap = new Map(byDate.map((d) => [d.date, d.uuids]));
    const sortedDates = byDate.map((d) => d.date).sort();
    const firstDate = sortedDates[0];
    const lastDate = sortedDates[sortedDates.length - 1];
    const maxCount = Math.max(...byDate.map((d) => d.count));

    // Expand grid to full weeks (Sun–Sat)
    const gridStart = addDays(firstDate, -dayOfWeek(firstDate));
    const endDow = dayOfWeek(lastDate);
    const gridEnd = addDays(lastDate, 6 - endDow);

    const cells: { date: string; count: number; week: number; day: number }[] =
      [];
    let current = gridStart;
    let week = 0;

    while (current <= gridEnd) {
      const dow = dayOfWeek(current);
      cells.push({
        date: current,
        count: countMap.get(current) ?? 0,
        week,
        day: dow,
      });
      if (dow === 6) week++;
      current = addDays(current, 1);
    }

    // Month labels at first Sunday of each new month
    const seenMonths = new Set<string>();
    const monthLabels: { label: string; week: number }[] = [];
    for (const cell of cells) {
      if (cell.day === 0) {
        const label = monthLabel(cell.date);
        if (!seenMonths.has(label)) {
          seenMonths.add(label);
          monthLabels.push({ label, week: cell.week });
        }
      }
    }

    return { cells, numWeeks: week, monthLabels, maxCount, uuidsMap };
  }, [sessions]);

  if (sessions.length === 0) {
    return (
      <ChartCard title="Participants Over Time">
        <p style={{ color: "#6b7280", fontSize: 13 }}>No data loaded.</p>
      </ChartCard>
    );
  }

  const svgWidth = DAY_COL + numWeeks * STEP + GAP;
  const gridHeight = 7 * STEP;
  const svgHeight = MONTH_ROW + gridHeight;

  return (
    <ChartCard title="Participants Over Time">
      <div
        ref={containerRef}
        style={{ overflowX: "auto", position: "relative" }}
      >
        <svg width={svgWidth} height={svgHeight + 28}>
          {/* Month labels */}
          {monthLabels.map(({ label, week }) => (
            <text
              key={label}
              x={DAY_COL + week * STEP}
              y={MONTH_ROW - 6}
              fontSize={10}
              fill="#6b7280"
            >
              {label}
            </text>
          ))}

          {/* Day-of-week labels */}
          {DAY_NAMES.map((name, i) =>
            SHOW_DAY_LABEL[i] ? (
              <text
                key={name}
                x={DAY_COL - 4}
                y={MONTH_ROW + i * STEP + CELL}
                fontSize={9}
                fill="#6b7280"
                textAnchor="end"
              >
                {name}
              </text>
            ) : null,
          )}

          {/* Calendar cells */}
          {cells.map((cell) => (
            <rect
              key={cell.date}
              x={DAY_COL + cell.week * STEP}
              y={MONTH_ROW + cell.day * STEP}
              width={CELL}
              height={CELL}
              rx={2}
              fill={cellColor(cell.count, maxCount)}
              style={{ cursor: onDayClick && cell.count > 0 ? "pointer" : "default" }}
              onClick={onDayClick && cell.count > 0 ? () => {
                const uuids = uuidsMap.get(cell.date) ?? [];
                if (uuids.length > 0) onDayClick(uuids);
              } : undefined}
              onMouseEnter={(e) => {
                if (!containerRef.current) return;
                const cr = containerRef.current.getBoundingClientRect();
                const rr = e.currentTarget.getBoundingClientRect();
                setTooltip({
                  date: cell.date,
                  count: cell.count,
                  x: rr.left - cr.left + rr.width / 2,
                  y: rr.top - cr.top,
                });
              }}
              onMouseLeave={() => setTooltip(null)}
            />
          ))}

          {/* Legend */}
          <text x={DAY_COL} y={svgHeight + 20} fontSize={9} fill="#6b7280">
            Less
          </text>
          {COLOR_SCALE.map((color, i) => (
            <rect
              key={i}
              x={DAY_COL + 28 + i * (CELL + 2)}
              y={svgHeight + 10}
              width={CELL}
              height={CELL}
              rx={2}
              fill={color}
            />
          ))}
          <text
            x={DAY_COL + 28 + COLOR_SCALE.length * (CELL + 2) + 4}
            y={svgHeight + 20}
            fontSize={9}
            fill="#6b7280"
          >
            More
          </text>
        </svg>

        {/* Tooltip rendered as HTML to avoid SVG overflow clipping */}
        {tooltip && (
          <div
            style={{
              position: "absolute",
              left: tooltip.x,
              top: tooltip.y - 34,
              transform: "translateX(-50%)",
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              color: "#111827",
              padding: "4px 8px",
              borderRadius: 4,
              fontSize: 11,
              whiteSpace: "nowrap",
              pointerEvents: "none",
              zIndex: 10,
              boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
            }}
          >
            {tooltip.count === 0
              ? `${tooltip.date} · [0]`
              : `${tooltip.date} · [${tooltip.count}]`}
          </div>
        )}
      </div>
    </ChartCard>
  );
}

