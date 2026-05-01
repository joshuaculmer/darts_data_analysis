// All colors in this file must follow PALETTE.md at the project root.
import { useMemo, useState, useRef } from "react";
import {
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { TrustTimePoint } from "../../utils/surveyStats";
import { AI_TYPE_LABELS } from "../../utils/stats";
import { AI_Type } from "../../types/dart";
import { ChartCard } from "../ChartCard";

interface Props {
  points: TrustTimePoint[];
  title?: string;
}

// Okabe-Ito palette colors (PALETTE.md) cycled per user line
const USER_LINE_COLORS = [
  "#0072B2",
  "#E69F00",
  "#D55E00",
  "#CC79A7",
  "#009E73",
  "#56B4E9",
  "#1d4ed8",
];

const TOOLTIP_STYLE = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 6,
  padding: "8px 12px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  fontSize: 12,
};

function CustomTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null;

  // Only show entries from Scatter series; Line series entries are suppressed
  const seen = new Set<string>();
  const points: TrustTimePoint[] = [];
  for (const entry of payload) {
    if (entry.type !== "scatter") continue;
    const d = entry.payload as TrustTimePoint;
    const key = `${d.user_uuid}-${d.sessionIndex}`;
    if (seen.has(key)) continue;
    seen.add(key);
    points.push(d);
  }

  if (points.length === 0) return null;

  return (
    <div style={TOOLTIP_STYLE}>
      {points.map((d, i) => (
        <div key={i} style={{ marginBottom: i < points.length - 1 ? 6 : 0 }}>
          <div style={{ fontWeight: 600, color: "#111827" }}>Session {d.sessionIndex}</div>
          <div style={{ color: d.color, marginTop: 2 }}>{d.label}</div>
          <div style={{ color: "#374151", marginTop: 1 }}>Trust: {d.trust}</div>
        </div>
      ))}
    </div>
  );
}

export function TrustOverTime({ points, title = "Trust Over Time" }: Props) {
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null);
  // Prevents the chart background click from immediately deselecting after a line click
  const lineClickedRef = useRef(false);

  const userLines = useMemo(() => {
    const map = new Map<string, TrustTimePoint[]>();
    for (const p of points) {
      const arr = map.get(p.user_uuid) ?? [];
      arr.push(p);
      map.set(p.user_uuid, arr);
    }
    return [...map.entries()].map(([uuid, pts]) => ({
      uuid,
      pts: [...pts].sort((a, b) => a.sessionIndex - b.sessionIndex),
    }));
  }, [points]);

  if (points.length === 0) {
    return (
      <ChartCard title={title}>
        <p style={{ color: "#6b7280", fontSize: 13 }}>No trust responses found for the selected question.</p>
      </ChartCard>
    );
  }

  const getLineOpacity = (uuid: string) => {
    if (selectedUuid === null) return 0.45;
    return uuid === selectedUuid ? 0.9 : 0.08;
  };

  return (
    <ChartCard title={title}>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart
          margin={{ top: 16, right: 24, left: 0, bottom: 24 }}
          onClick={() => {
            if (lineClickedRef.current) {
              lineClickedRef.current = false;
              return;
            }
            setSelectedUuid(null);
          }}
        >
          <CartesianGrid horizontal vertical={false} stroke="#e5e7eb" />
          <XAxis
            dataKey="sessionIndex"
            name="Session"
            type="number"
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#374151" }}
            label={{ value: "Session Number", position: "insideBottom", offset: -12, fontSize: 11, fill: "#374151" }}
          />
          <YAxis
            dataKey="trust"
            name="Trust Rating"
            type="number"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#374151" }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: "4 3", stroke: "#d1d5db" }} />

          {/* Per-user connecting lines */}
          {userLines.map(({ uuid, pts }, i) => (
            <Line
              key={uuid}
              data={pts}
              dataKey="trust"
              stroke={USER_LINE_COLORS[i % USER_LINE_COLORS.length]}
              strokeWidth={selectedUuid === uuid ? 2.5 : 1.5}
              strokeOpacity={getLineOpacity(uuid)}
              dot={false}
              isAnimationActive={false}
              legendType="none"
              style={{ cursor: "pointer" }}
              onClick={() => {
                lineClickedRef.current = true;
                setSelectedUuid(uuid === selectedUuid ? null : uuid);
              }}
            />
          ))}

          {/* Colored scatter dots by AI condition */}
          {(Object.values(AI_Type).filter((v) => typeof v === "number") as AI_Type[]).map((type) => {
            const group = points.filter((p) => p.aiType === type);
            if (group.length === 0) return null;
            return (
              <Scatter key={type} name={AI_TYPE_LABELS[type]} data={group} isAnimationActive={false}>
                {group.map((point, idx) => {
                  const dimmed = selectedUuid !== null && point.user_uuid !== selectedUuid;
                  return (
                    <Cell
                      key={idx}
                      fill={group[0].color}
                      fillOpacity={dimmed ? 0.08 : 0.85}
                      stroke={dimmed ? "transparent" : "#ffffff"}
                      strokeWidth={1}
                    />
                  );
                })}
              </Scatter>
            );
          })}
        </ComposedChart>
      </ResponsiveContainer>
      <p style={{ fontSize: 11, color: "#6b7280", marginTop: -4 }}>
        Each point is one post-session survey response, colored by AI condition. Lines connect each participant's sessions.{" "}
        {selectedUuid ? "Click the chart background to deselect." : "Click a line to highlight that participant."}
      </p>
    </ChartCard>
  );
}
