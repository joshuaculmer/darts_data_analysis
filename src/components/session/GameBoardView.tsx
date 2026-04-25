import { useRef, useEffect } from "react";
import type { DartGameDTO, RewardSurface } from "../../types/dart";
import { gameScore } from "../../utils/scoreStats";

const VIRIDIS: [number, number, number][] = [
  [68, 1, 84], [72, 36, 117], [65, 68, 135], [53, 95, 141],
  [42, 120, 142], [33, 145, 140], [34, 168, 132], [68, 191, 112],
  [122, 209, 81], [189, 223, 38], [253, 231, 37],
];

const SIZE = 512;

interface Props {
  game: DartGameDTO;
  surface: RewardSurface;
}

export function GameBoardView({ game, surface }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const score = gameScore(game, surface);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw heatmap — mirrors original arrayToImage logic exactly
    const imageData = ctx.createImageData(SIZE, SIZE);
    const data = imageData.data;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const v = surface[x]?.[y];
        if (v !== undefined) {
          const pixelIndex = (y * SIZE + x) * 4;
          const rgb = VIRIDIS[Math.min(Math.max(Math.round(v), 0), VIRIDIS.length - 1)];
          data[pixelIndex]     = rgb[0];
          data[pixelIndex + 1] = rgb[1];
          data[pixelIndex + 2] = rgb[2];
          data[pixelIndex + 3] = 255;
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);

    // Suggested aiming coord — red × reticle (drawn first, under actual aim and hits)
    if (game.suggested_aiming_coord) {
      const { x, y } = game.suggested_aiming_coord;
      const d = 11; // 15 * sin(45°) ≈ 10.6, rounded up slightly
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - d, y - d); ctx.lineTo(x + d, y + d);
      ctx.moveTo(x + d, y - d); ctx.lineTo(x - d, y + d);
      ctx.stroke();
    }

    // Actual aiming coord — white fill with red outline (drawn second, under hits)
    {
      const { x, y } = game.actual_aiming_coord;
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fill();
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 15, y); ctx.lineTo(x + 15, y);
      ctx.moveTo(x, y - 15); ctx.lineTo(x, y + 15);
      ctx.stroke();
    }

    // Hits — black dots with white outline, drawn last so they're never obscured
    for (const hit of game.hits) {
      ctx.beginPath();
      ctx.arc(hit.x, hit.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = "#000000";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }, [game, surface]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 11, flexWrap: "wrap" }}>
        <span style={{ color: "#ef4444" }}>⊕ Actual aim</span>
        {game.suggested_aiming_coord
          ? <span style={{ color: "#ef4444", opacity: 0.6 }}>⊕ Suggested aim</span>
          : <span style={{ color: "#475569" }}>No suggestion (NONE condition)</span>}
        <span style={{ color: "#94a3b8" }}>● Hits</span>
        <span style={{ color: "#94a3b8" }}>
          Score: <strong style={{ color: "#e2e8f0" }}>{score.toFixed(2)}</strong>
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={SIZE}
        height={SIZE}
        style={{
          border: "1px solid #334155",
          imageRendering: "pixelated",
          width: SIZE,
          height: SIZE,
        }}
      />
    </div>
  );
}
