export type PointClickMode = "navigate" | "highlight";

interface Props {
  mode: PointClickMode;
  onChange: (mode: PointClickMode) => void;
}

const BTN_BASE: React.CSSProperties = {
  fontSize: 11,
  padding: "3px 10px",
  borderRadius: 999,
  border: "1px solid #d1d5db",
  cursor: "pointer",
  fontFamily: "inherit",
};

export function PointClickModeToggle({ mode, onChange }: Props) {
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
      <button
        onClick={() => onChange("navigate")}
        style={{
          ...BTN_BASE,
          background: mode === "navigate" ? "#1d4ed8" : "#ffffff",
          color: mode === "navigate" ? "#ffffff" : "#374151",
          fontWeight: mode === "navigate" ? 600 : 400,
        }}
      >
        Navigate to Session
      </button>
      <button
        onClick={() => onChange("highlight")}
        style={{
          ...BTN_BASE,
          background: mode === "highlight" ? "#1d4ed8" : "#ffffff",
          color: mode === "highlight" ? "#ffffff" : "#374151",
          fontWeight: mode === "highlight" ? 600 : 400,
        }}
      >
        Highlight User
      </button>
    </div>
  );
}
