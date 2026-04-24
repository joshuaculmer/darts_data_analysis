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

    // Hits — small white dots with thin black outline
    ctx.globalAlpha = 0.9;
    for (const hit of game.hits) {
      ctx.beginPath();
      ctx.arc(hit.x, hit.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Suggested aiming coord — cyan reticle (drawn first so actual aim renders on top)
    if (game.suggested_aiming_coord) {
      const { x, y } = game.suggested_aiming_coord;
      ctx.strokeStyle = "#00e5ff";
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 15, y); ctx.lineTo(x + 15, y);
      ctx.moveTo(x, y - 15); ctx.lineTo(x, y + 15);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Actual aiming coord — yellow reticle
    {
      const { x, y } = game.actual_aiming_coord;
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 15, y); ctx.lineTo(x + 15, y);
      ctx.moveTo(x, y - 15); ctx.lineTo(x, y + 15);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }, [game, surface]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 11, flexWrap: "wrap" }}>
        <span style={{ color: "#fbbf24" }}>⊕ Actual aim</span>
        {game.suggested_aiming_coord
          ? <span style={{ color: "#00e5ff" }}>⊕ Suggested aim</span>
          : <span style={{ color: "#475569" }}>No suggestion (NONE condition)</span>}
        <span style={{ color: "#cbd5e1" }}>● Hits</span>
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
