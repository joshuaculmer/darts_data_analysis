import type { IndividualSessionPoint } from "../../utils/individualStats";
import { ChartCard } from "../ChartCard";

interface Props {
  points: IndividualSessionPoint[];
}

export function ConditionExposure({ points }: Props) {
  if (points.length === 0) {
    return (
      <ChartCard title="Condition Exposure">
        <p style={{ color: "#6b7280", fontSize: 13 }}>No sessions found.</p>
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Condition Exposure">
      <div className="condition-exposure-track">
        {points.map((p) => (
          <div key={p.sessionIndex} className="condition-exposure-step">
            <div
              className="condition-exposure-dot"
              style={{ background: p.color }}
              title={`Session ${p.sessionIndex}: ${p.label}`}
            />
            <span className="condition-exposure-label">{p.label}</span>
            <span className="condition-exposure-date">{p.date}</span>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 11, color: "#6b7280", marginTop: 8 }}>
        Sessions in chronological order, colored by AI condition assigned by the admin.
      </p>
    </ChartCard>
  );
}
