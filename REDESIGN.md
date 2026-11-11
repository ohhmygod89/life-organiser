# Redesign (Pulse) — design system notes

Branch `redesign`, version `1.0.0-beta.29.redesign.1`. Front end only: no feature, data, storage or behaviour changes.
All new CSS is one block at the end of `src/styles.css` (`/* ===== REDESIGN (Pulse) ===== */`); it overrides the older layers instead of deleting them.

## Look
Soft grey canvas, big white cards (26px radius, 16–18px inner items), almost no hairlines, very soft shadows, tight tracking on headings and big numbers.
Controls are pills: segmented control = grey track with a **solid black active pill**; chips = white pills, active = black; primary buttons = black pills (white pills in dark).
Colour appears only in the three kinds of **hero** (below) and in data (priority bars, flag chips, chart dots, Bills category dots, status ticks).

## Font (one place)
`--font-ui` at the top of the REDESIGN layer; `--font` points at it. Default is the system stack (SF Pro on iPhone/Mac), nothing is downloaded.
To switch to Inter: uncomment the two `<link>` lines in the comment at the top of `src/shell.html`, and set
`--font-ui: "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;`
(the old Google Fonts link was removed from `build.py`).

## Tokens (light / dark)
| token | light | dark |
|---|---|---|
| `--bg` canvas | `#ededee` | `#0e0e10` |
| `--panel` card | `#ffffff` | `#18181b` |
| `--fill` track / pills | `#e4e4e7` | `#27272c` |
| `--fill-2`, `--item` inner items | `#f4f4f5` / `#f5f5f6` | `#1f1f23` |
| `--fg` text | `#111113` | `#f2f2f3` |
| `--muted` | `#66666b` | `#8e8e93` |
| `--accent` / `--accent-fill` (ink) | `#111113` | `#f2f2f3` (`--on-accent` is the text on it) |
| `--seg-on`, `--chip-on` | black, white text | white, black text |
| `--dock-bg` | `#141416` | `#1b1b1f` + 1px light border |
| `--dot-off` / `--dot-blue` / `--dot-coral` | `#dcdce0` / `#4558d6` / `#c93463` | `#2b2b31` / `#8c9dff` / `#ff6b8f` |
Unchanged in meaning: `--up --down --warn --now --p-high --p-med --p-low --sw-on --ok-bg`, `--shadow*`, `--pop-shadow`, `--scrim`. New: `--shadow-card`, `--r-card`, `--r-item`.

## Gradient hero palettes
Each palette is three stops: highlight `a`, base `b`, deep `c` (`--lav-a/b/c`, `--blue-*`, `--coral-*`, `--green-*`, `--peach-*`), composed into `--pal-lav|blue|coral|green|peach` (radial aurora blobs + diagonal base). Dark mode redefines only the stops (deeper).
Hero surface = the palette + a feTurbulence grain overlay (`--grain`, overlay blend, 34%) + a soft dark scrim under the text (keeps white text above 4.5:1) + inner top highlight. Icon buttons on heroes are "smoked glass" circles (dark 26% fill, blur, light ring) so white glyphs keep 3:1.
Used on **only**:
- Home stat tiles (`.home-stats .stat`): Open tasks lavender, Overdue coral, Due in 7 days blue, Flagged peach, Bills green.
- Item page header `.ihead` by type (`PALETTE_BY_TYPE` in core.js): Kanban lavender, Bills coral, Tracker blue, Page green.
- Kanban stack headers `.lane-hi`: rotate lavender, blue, coral, green, peach (`.lane:nth-child(5n+k)`).
Measured contrast of white text on every hero (pixel-sampled with the text hidden, light/dark, phone/desktop): small text >= 4.9:1, large text and icons >= 3.3:1.

## Components
Sidebar: canvas-coloured, white search pill, active item = black (white in dark) pill, wordmark "Life" black + "Organiser" grey. Phone: floating white card above the dock.
Kanban: filter groups are plain labels + chips on the canvas; columns are white cards holding grey inner task cards; Done column keeps a faint green tint.
Timeline: structure unchanged, pill bars. Sheet/modals/menus: 28–30px radius, soft shadow, black pill actions. Page blocks, editor toolbar (active = black), tables, checklist: white cards.
Charts: **Tracker** chart is a dot matrix (SVG, one path for filled dots and one for empty dots; each column filled up to the value at that date; hover/tap tooltip unchanged). **Bills** yearly timeline: each bill is a row of dots (grey = year, coloured = term, status dots unchanged and still clickable) and the Total row is dot columns (8 dots = busiest month).

## Phone dock (<= 860px)
`#dock` in `shell.html`: ☰ (`#fab`, becomes ✕ while the menu is open) · Filter (`#dkFilter`, count badge, Kanban only) · + New task (`#dkNew`, Kanban only; runs `TYPE_VIEWS.kanban.newShortcut`, switching List/Timeline/Archive to Board first). Filled in by `renderDock()` in `core.js`. Hidden while the task window is open or a card is dragged. Not shown on desktop.

## JS/markup touched (behaviour unchanged)
`core.js`: `renderDock`, dock click handler, `PALETTE_BY_TYPE` + `pal-*` class in `headHTML`, `home-stats` class on Home tiles, Filter button removed from the Kanban bar markup (moved to the dock). `shell.html`: dock, wordmark spans, font comment. `tracker.js`: `drawChart` draws dots. `bills.js`: dot columns in the Total row. `build.py`: Google Fonts link removed.
