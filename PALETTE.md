# Visual Design Palette

> **Rule for contributors and AI agents**: All CSS files, inline styles, and Recharts component props must follow this palette. Do not introduce colors, fonts, or chart styling outside this document without updating it first.

---

## Typography

| Role | Value |
|---|---|
| Font family | `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` |
| Base size | `14px` (browser default 16px; components use `0.875rem`) |
| Monospace | `'JetBrains Mono', 'Fira Code', monospace` (raw data tables only) |

---

## UI Color Palette (App shell, cards, forms, navigation)

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#ffffff` | Page background, card backgrounds |
| `--bg-muted` | `#f9fafb` | Inset surfaces, table row stripes, upload areas |
| `--border` | `#e5e7eb` | All borders — cards, inputs, dividers |
| `--border-strong` | `#d1d5db` | Active/focused borders, strong dividers |
| `--text-1` | `#111827` | Primary text — headings, KPI values |
| `--text-2` | `#374151` | Secondary text — body copy, table data |
| `--text-3` | `#6b7280` | Muted text — labels, captions, hints |
| `--text-4` | `#9ca3af` | Placeholder text, disabled states |
| `--accent` | `#1d4ed8` | Active nav tab, primary buttons, focus rings, upload highlight |
| `--accent-hover` | `#1e40af` | Hover state for accent elements |
| `--danger` | `#dc2626` | Destructive buttons (Clear Data) |
| `--danger-hover` | `#b91c1c` | Hover state for danger elements |
| `--success` | `#16a34a` | Loaded/complete status indicators |
| `--success-bg` | `#f0fdf4` | Background for success badges |
| `--success-border` | `#bbf7d0` | Border for success badges |

### Border radius
- Cards, modals, upload items: `8px`
- Buttons, inputs, badges, tabs: `6px`
- Pills (survey status badge): `999px`

### Borders
- Always `1px solid var(--border)` — never thicker, never colored except for accent states

---

## Graph Palette (Recharts — bar charts, scatter plots, line charts)

### Plot surface
| Element | Rule | Value |
|---|---|---|
| Chart background | Transparent (inherits white card) | — |
| CartesianGrid | Horizontal lines only, no vertical, solid | stroke `#e5e7eb`, strokeDasharray `none` |
| XAxis / YAxis line | Hidden | `axisLine={false}` |
| Tick labels | Neutral dark, small | fill `#374151`, fontSize `11` |
| Axis title labels | Same as ticks | fill `#374151`, fontSize `11` |

### Bars
| Element | Rule | Value |
|---|---|---|
| Bar corners | Square tops — no rounding | `radius={[0, 0, 0, 0]}` |
| Bar fill opacity | Full | `fillOpacity={1}` |
| Animation | Off | `isAnimationActive={false}` |
| Error bars | Dark, thin | stroke `#374151`, strokeWidth `1.5` |

### Scatter / line plots
| Element | Rule | Value |
|---|---|---|
| Dot fill | Condition color, full opacity | — |
| Dot stroke | White outline for separation | `stroke="#ffffff"`, strokeWidth `1` |
| Line stroke | Condition color | strokeWidth `2` |
| Reference lines | Muted dashed | stroke `#d1d5db`, strokeDasharray `4 3` |

### Tooltip
```
background:    #ffffff
border:        1px solid #e5e7eb
border-radius: 6px
padding:       8px 12px
box-shadow:    0 1px 4px rgba(0,0,0,0.08)
title color:   #111827, fontWeight 600
value color:   #374151
meta color:    #6b7280
fontSize:      12
```

### PNG export background
- Always export on **white** (`#ffffff`) — publication-ready

---

## Categorical Condition Color Palette (Okabe-Ito)

Colorblind-safe, print-safe. Used for all per-condition coloring in charts.

| Condition | Color name | Hex |
|---|---|---|
| NONE | Neutral grey | `#6b7280` |
| CORRECT | Blue | `#0072B2` |
| RANDOM | Amber | `#E69F00` |
| WRONG | Vermillion | `#D55E00` |
| BAD | Mauve | `#CC79A7` |
| GOOD_BAD | Teal | `#009E73` |
| BAD_GOOD | Sky blue | `#56B4E9` |

These replace any previously assigned `color` values on `AI_Type` conditions. The mapping should live in a single constants file (e.g. `src/utils/colors.ts`) and be imported everywhere conditions are colored — never duplicated inline.

---

## Likert Distribution Stack Colors

For 100% stacked Likert bars (1→5), use a fixed low→high progression:

| Likert bucket | Hex |
|---|---|
| 1 (lowest agreement/perception) | `#D55E00` |
| 2 | `#E69F00` |
| 3 (neutral) | `#9ca3af` |
| 4 | `#56B4E9` |
| 5 (highest agreement/perception) | `#009E73` |

These colors are used for response level segments, while AI condition identity remains encoded by condition labels/outlines where applicable.

---

## What NOT to do

- No dark backgrounds anywhere (`#0f172a`, `#1e293b`, `#334155`, etc.)
- No slate-blue text colors (`#94a3b8`, `#cbd5e1`, etc.)
- No dashed grid lines (`strokeDasharray="3 3"`)
- No rounded bar tops in bar charts
- No per-component hardcoded color decisions — always import from the palette
- No box-shadows beyond the tooltip subtle shadow above
- No gradient fills in charts
