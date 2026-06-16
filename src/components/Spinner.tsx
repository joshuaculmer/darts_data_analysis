import "./Spinner.css";

interface SpinnerProps {
  /** Optional caption rendered beneath the spinning board. */
  label?: string;
  /** Extra class names for layout (e.g. centering inside a section). */
  className?: string;
}

/**
 * Dartboard loading spinner — a miniature rotating board. Drop it anywhere
 * something is loading or being computed. Self-contained (styles in
 * Spinner.css); the dartboard colors are scoped to this component.
 */
export function Spinner({ label, className }: SpinnerProps) {
  return (
    <div className={`darts-spinner${className ? ` ${className}` : ""}`} role="status" aria-live="polite">
      <div className="board">
        <div className="bull" />
      </div>
      {label && <p className="darts-spinner__label">{label}</p>}
    </div>
  );
}
