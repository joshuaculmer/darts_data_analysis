import type { RewardSurface } from "../types/dart";
import type { ParsedGameSession } from "./loadData";

function boardUrl(boardId: number): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${base}/Perlin_Noise_Surfaces.ts/PerlinNoiseBoard${boardId}.json`;
}

export async function loadBoards(
  sessions: ParsedGameSession[],
): Promise<Map<number, RewardSurface>> {
  const boardIds = new Set(
    sessions.flatMap((s) => s.games.map((g) => g.board_id)),
  );

  const results = await Promise.allSettled(
    [...boardIds].map(async (id) => {
      const res = await fetch(boardUrl(id));
      if (!res.ok) throw new Error(`Board ${id} returned ${res.status}`);
      const surface = (await res.json()) as RewardSurface;
      return [id, surface] as const;
    }),
  );

  const boards = new Map<number, RewardSurface>();
  for (const result of results) {
    if (result.status === "fulfilled") {
      const [id, surface] = result.value;
      boards.set(id, surface);
    } else {
      console.warn("Failed to load board surface:", result.reason);
    }
  }
  return boards;
}
