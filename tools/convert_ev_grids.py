"""Convert experiment_ev_grids.npz into per-pair binary EV grids for the app.

Input: experiment_ev_grids.npz at the project root, with arrays:
  ev        (N, 512, 512) float32 — EV per aim cell
  board_ids (N,) int      — board id per grid (unified 0–199 id space)
  skills    (N,) int      — execution skill per grid
  resolution, extent      — grid metadata (1 px, ±256; index-aligned with boards)

The npz grids are TRANSPOSED relative to the board surfaces (verified by
correlating each grid against a Gaussian-smoothed board surface: r≈0.98
transposed vs r≈0.25 untransposed). The app indexes surfaces as
surface[floor(x)][floor(y)], so each grid is transposed here once, at
conversion time, to match that convention.

Output:
  public/ev_grids/ev_{board}_{skill}.bin — 512*512 little-endian uint16,
    row-major in [x][y] order; EV = value * (100 / 65535)
  public/ev_grids/index.json — { size, scale, pairs: [[board, skill], ...] }
"""

import json
import os

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NPZ = os.path.join(ROOT, "experiment_ev_grids.npz")
OUT_DIR = os.path.join(ROOT, "public", "ev_grids")

SIZE = 512
SCALE = 100 / 65535  # EV = uint16 * SCALE; npz max EV is 99.99 < 100


def main() -> None:
    z = np.load(NPZ)
    ev, board_ids, skills = z["ev"], z["board_ids"], z["skills"]
    assert ev.shape[1:] == (SIZE, SIZE), ev.shape
    # EV is 0–100 up to float noise (min observed ≈ -2.7e-14); clip before quantizing.
    assert float(ev.max()) <= 100.0 and float(ev.min()) >= -1e-6, (ev.min(), ev.max())

    os.makedirs(OUT_DIR, exist_ok=True)
    pairs = []
    for grid, board, skill in zip(ev, board_ids, skills):
        board, skill = int(board), int(skill)
        # Transpose to surface [x][y] convention, then quantize.
        q = np.round(np.clip(grid.T.astype(np.float64), 0, 100) / SCALE).astype("<u2")
        with open(os.path.join(OUT_DIR, f"ev_{board}_{skill}.bin"), "wb") as f:
            f.write(q.tobytes())
        pairs.append([board, skill])

    with open(os.path.join(OUT_DIR, "index.json"), "w") as f:
        json.dump({"size": SIZE, "scale": SCALE, "pairs": sorted(pairs)}, f)
    print(f"Wrote {len(pairs)} grids to {OUT_DIR}")


if __name__ == "__main__":
    main()
