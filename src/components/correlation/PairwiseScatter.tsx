// All colors in this file must follow PALETTE.md at the project root.
import {
  ScatterChart,
  Scatter,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useNavigate } from "react-router-dom";
import { AI_Type } from "../../types/dart";
import { AI_TYPE_LABELS, AI_TYPE_COLORS } from "../../utils/stats";
import { VARIABLES, type SessionVariableRow, type VariableKey } from "../../utils/variables";
import { ChartCard } from "../ChartCard";

interface Props {
  rows: SessionVariableRow[];
  xKey: VariableKey;
  yKey: VariableKey;
  title?: string;
}

const TOOLTIP_STYLE = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 6,
  padding: "8px 12px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  fontSize: 12,
};

interface PairPoint {
  x: number;
  y: number;
  user_uuid: string;
  sessionIndex: number;
  aiType: AI_Type;
}

/**
 * Generic x-variable vs y-variable scatter, colored by AI condition. Drops rows
 * where either variable is null (pairwise-complete). Clicking a dot navigates to
 * that session in Session View. Reuses ChartCard.
 */
export function PairwiseScatter({ rows, xKey, yKey, title }: Props) {
  const navigate = useNavigate();
  const xVar = VARIABLES[xKey];
  const yVar = VARIABLES[yKey];
  const resolvedTitle = title ?? `${yVar.label} vs ${xVar.label}`;

  const points: PairPoint[] = rows.flatMap((r) => {
    const x = xVar.accessor(r);
    const y = yVar.accessor(r);
    if (x === null || y === null) return [];
    return [{ x, y, user_uuid: r.user_uuid, sessionIndex: r.sessionIndex, aiType: r.ai_advice }];
  });

  if (points.length === 0) {
    return (
      <ChartCard title={resolvedTitle}>
        <p style={{ color: "#6b7280", fontSize: 13 }}>No sessions have both {xVar.label} and {yVar.label}.</p>
      </ChartCard>
    );
  }

  return (
    <ChartCard title={resolvedTitle}>
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 16, right: 24, left: 0, bottom: 24 }} aria-label={`${yVar.label} versus ${xVar.label}`}>
          <CartesianGrid horizontal vertical={false} stroke="#e5e7eb" />
          <XAxis
            dataKey="x"
            name={xVar.label}
            type="number"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#374151" }}
            tickFormatter={(v) => xVar.format(Number(v))}
            label={{ value: xVar.label, position: "insideBottom", offset: -12, fontSize: 11, fill: "#374151" }}
          />
          <YAxis
            dataKey="y"
            name={yVar.label}
            type="number"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#374151" }}
            tickFormatter={(v) => yVar.format(Number(v))}
            label={{ value: yVar.label, angle: -90, position: "insideLeft", fontSize: 11, fill: "#374151" }}
          />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: "#111827", fontWeight: 600 }}
            itemStyle={{ color: "#374151" }}
            formatter={(value, name) => {
              const v = typeof value === "number" ? value : Number(value);
              if (name === xVar.label) return [xVar.format(v), xVar.label];
              if (name === yVar.label) return [yVar.format(v), yVar.label];
              return [v, name];
            }}
          />
          {(Object.values(AI_Type).filter((v) => typeof v === "number") as AI_Type[]).map((type) => {
            const group = points.filter((p) => p.aiType === type);
            if (group.length === 0) return null;
            return (
              <Scatter
                key={type}
                name={AI_TYPE_LABELS[type]}
                data={group}
                isAnimationActive={false}
                onClick={(d) => {
                  const p = d as unknown as PairPoint;
                  navigate(`/session/${p.user_uuid}/${p.sessionIndex}`);
                }}
                style={{ cursor: "pointer" }}
              >
                {group.map((_, i) => (
                  <Cell key={i} fill={AI_TYPE_COLORS[type]} fillOpacity={0.8} stroke="#ffffff" strokeWidth={1} />
                ))}
              </Scatter>
            );
          })}
        </ScatterChart>
      </ResponsiveContainer>
      <p style={{ fontSize: 11, color: "#6b7280", marginTop: -4 }}>
        Each point is one session, colored by AI condition. Click a point to open it in Session View.
        {` n=${points.length}.`}
      </p>
    </ChartCard>
  );
}
