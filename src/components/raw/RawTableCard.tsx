// All colors in this file must follow PALETTE.md at the project root.
import { useState } from "react";
import { Minus, Plus } from "lucide-react";

interface Props {
  title: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Card wrapper for the Raw Data tables. Provides a collapse toggle in the
 * top-right corner (matching ChartCard) and hides the body when collapsed.
 * The boxed/resizable scroll behaviour lives on the `.table-scroll--boxed`
 * element the caller renders inside.
 */
export function RawTableCard({ title, children }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="chart-card">
      <div className="chart-card__header">
        <h2 className="chart-card__title">{title}</h2>
        <div className="chart-card__actions">
          <button
            className="chart-card__btn"
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <Plus size={13} /> : <Minus size={13} />}
          </button>
        </div>
      </div>
      {!collapsed && children}
    </div>
  );
}
