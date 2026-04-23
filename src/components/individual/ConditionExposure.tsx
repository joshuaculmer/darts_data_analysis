import type { IndividualSessionPoint } from "../../utils/individualStats";

interface Props {
  points: IndividualSessionPoint[];
}

export function ConditionExposure({ points }: Props) {
  if (points.length === 0) {
    return (
      <div className="chart-card">
        <h2>Condition Exposure</h2>
        <p style={{ color: "#475569", fontSize: 13 }}>No sessions found.</p>
      </div>
    );
  }

  return (
    <div className="chart-card">
      <h2>Condition Exposure</h2>
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
      <p style={{ fontSize: 11, color: "#64748b", marginTop: 8 }}>
        Sessions in chronological order, colored by AI condition assigned by the admin.
      </p>
    </div>
  );
}
