// All colors in this file must follow PALETTE.md at the project root.
import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

export interface VirtualColumn<Row> {
  /** Stable identity for the column (React key). */
  key: string;
  header: React.ReactNode;
  /** Fixed column width in px (the table uses table-layout: fixed). */
  width: number;
  /** Right-align + tabular figures for numeric columns. */
  numeric?: boolean;
  /** Override alignment (defaults to right for numeric, left otherwise). */
  align?: "left" | "right";
  /** Truncate overflow with an ellipsis (for long text like nicknames). */
  ellipsis?: boolean;
  /** Click handler for the header cell (sorting). */
  onHeaderClick?: () => void;
  cell: (row: Row, index: number) => React.ReactNode;
}

interface Props<Row> {
  columns: VirtualColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row, index: number) => React.Key;
  /** Row height in px — must match the rendered height for exact scrolling. */
  rowHeight?: number;
  overscan?: number;
}

/**
 * A sticky-header data table that only renders the rows currently in view.
 * Built on @tanstack/react-virtual using the spacer-row technique so it keeps
 * native `<table>` semantics (and the existing `.data-table` chrome) while
 * mounting ~30 rows instead of thousands.
 *
 * Trade-off (accepted): off-screen rows are not in the DOM, so browser
 * find-in-page (Ctrl+F) and full-table text selection only cover visible rows.
 * Filtering and CSV export operate on the full data array and are unaffected.
 */
export function VirtualizedTable<Row>({
  columns,
  rows,
  rowKey,
  rowHeight = 32,
  overscan = 12,
}: Props<Row>) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan,
  });

  const items = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  const paddingTop = items.length > 0 ? items[0].start : 0;
  const paddingBottom =
    items.length > 0 ? totalSize - items[items.length - 1].end : 0;
  const totalWidth = columns.reduce((sum, c) => sum + c.width, 0);

  function cellStyle(c: VirtualColumn<Row>): React.CSSProperties {
    const align = c.align ?? (c.numeric ? "right" : "left");
    return {
      textAlign: align,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: c.ellipsis ? "ellipsis" : "clip",
      fontVariantNumeric: c.numeric ? "tabular-nums" : undefined,
    };
  }

  return (
    <div className="table-scroll table-scroll--boxed" ref={scrollRef}>
      <table
        className="data-table"
        style={{ tableLayout: "fixed", width: totalWidth, minWidth: "100%" }}
      >
        <colgroup>
          {columns.map((c) => (
            <col key={c.key} style={{ width: c.width }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                onClick={c.onHeaderClick}
                style={{
                  textAlign: c.align ?? (c.numeric ? "right" : "left"),
                  cursor: c.onHeaderClick ? "pointer" : undefined,
                }}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paddingTop > 0 && (
            <tr style={{ height: paddingTop }}>
              <td colSpan={columns.length} style={{ padding: 0, border: "none" }} />
            </tr>
          )}
          {items.map((vi) => {
            const row = rows[vi.index];
            return (
              <tr key={rowKey(row, vi.index)} style={{ height: rowHeight }}>
                {columns.map((c) => (
                  <td key={c.key} style={cellStyle(c)}>
                    {c.cell(row, vi.index)}
                  </td>
                ))}
              </tr>
            );
          })}
          {paddingBottom > 0 && (
            <tr style={{ height: paddingBottom }}>
              <td colSpan={columns.length} style={{ padding: 0, border: "none" }} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
