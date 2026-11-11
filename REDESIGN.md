# Redesign (Pulse) — design system notes

Branch `redesign`, version `1.0.0-beta.29.redesign.5`. Front end only, except the two behaviour changes approved in round 4 (phone new-task sheet, phone one-column Kanban).
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

## Round 1 (redesign.2): closer Pulse match
- **Palettes** are now light, luminous meshes with four stops each (`--lav|blue|coral|pink|green|peach` `-a` highlight, `-b` body, `-c` deep (kept bottom/left behind the text), `-d` warm bloom). Text on heroes stays white with a 1px soft text-shadow; no dark scrim. Measured worst-pixel contrast of the big values is about 2.5 to 3.9:1 in light, 3.2 to 5:1 in dark (small labels are softer, 1.5 to 3:1) - the user's choice.
- **Weights**: 500 for titles, hero values, big numbers; 600 only for row/section titles; Home heading is two-tone (date grey, title black, `.hd2`).
- **Heroes**: Home tiles = icon + label top left, medium value bottom left, caption, translucent circle with an arrow top right. Item header = title bottom left, type icon in the circle. Kanban stack headers are plain white cards with a small gradient dot (the item header is the only gradient hero on Kanban).
- **Tile colours** (new): right-click / double-tap (phone) / Menu key or Shift+F10 on a Home tile opens a "Tile colour" menu (Default, Lavender, Sky, Coral, Rose, Peach, Mint). Stored per device in `localStorage` key `lo.tileColors` (JSON `{tileId: palette}`, ids `open overdue week waiting bills`); absent = default. Disabled tiles (count 0) now use `aria-disabled` so the menu still works.
- **Dock**: floating white pill (dark in dark mode): round menu, black "+ New task" pill with a gradient orb, round Filter (count badge).
- **Controls**: segmented = white (or light-grey inside cards) track, solid black active pill (white in dark).
- **Dot charts**: Tracker = discrete columns 14 to 16px apart, one dot per 8px row, a faint single baseline row, top two dots stronger. Bills = one faint dot row per bill, one coloured dot row per term, Total = single dot columns with a yellow-orange-red gradient (CSS mask). No filled areas, no background grid.
- **Rows**: Home rows have a round gradient icon, 600 title, grey subtitle, due text right (under the subtitle on phones). Kanban column headers use a small status dot and sentence case. Timeline bars are lavender gradient pills.

## Round 2 (redesign.3)
- **Rule: dots appear only in quantity charts, never as lines or connectors.** Bills rows are thin solid lines (2px faint grey before the start, 4px rounded bar in the bill colour where a term runs); only the Bills Total row is a dot chart (9px pitch, gradient mask).
- **Tracker** is a true dot matrix: square grid (pitch 9px phone, 10px desktop), equal 4.4px dots in every column, six colour levels by height (`.dots.l0`..`.l5`, light `--dot-lite` at the bottom to saturated `--dot-blue` at the top), no baseline, no emphasised top row.
- Home heading: small grey date (14.5px) over a 28-32px medium title. Tile labels keep 8px+ clear of the arrow circle (2 lines then ellipsis). Bills stat cards are white versions of the Home tiles (icon + label, value 500, caption). Item-header circle matches the tile circle (32px, same inset, slightly darkened backdrop so it shows on the light bloom).

## Round 3 (redesign.4): Pulse layout and spacing
Layout and spacing may change; features and behaviour do not. Everything below is the last CSS block in `styles.css` ("round 3"), plus small markup changes in `shell.html` and `renderSide`/`renderHome` in `core.js`.
- **Sidebar** is a white panel (dark `#141416`) beside the grey canvas: logo mark + "Life Organiser" wordmark with the app "..." menu, a 32px search, tiny uppercase section labels ("Main", folder names with a faint collapse chevron, "Create"), 34px rows with a soft grey active pill, black circular count badges (white in dark mode), compact New item / New folder rows. "Drag items here" only shows while dragging (`body.nav-dragging`); empty folders stay droppable.
- **Bottom card** (`.side-card`) is pinned to the panel bottom: app icon, name, version (still the What's new popover, which now opens upwards) and "Demo · sample data" in demo mode. Tapping the card opens the same app menu as the top "..." (`data-act="app-menu"`). On a phone the card sits at the bottom of the menu card.
- **Page header** on desktop is one compact row: gradient icon circle, title (still editable), grey sub-line; the page's own actions (Bills Timeline/List, year nav, Add bill; Kanban View menu) sit at its right edge via a CSS grid on `.wrap` (`#tv` and `.kb`/`.kb-bar` use `display:contents`, so the controls and their handlers are unchanged). Below 1040px they drop to their own row. Phones keep the gradient hero.
- **Top bar** has a black "New item" pill (same action as the sidebar New item and the N key); hidden on phones.
- **Density**: card titles 15px, rows 13px, captions 11.5px, cards 16-20px padding, radius 20-22, gaps 12-14, hairline separators; Kanban chips/cards/columns tightened; tables get small uppercase headers. Desktop (mouse) body type is 13.5px; touch keeps roomier sizes, 16px inputs and 40px tap targets.
- **Home**: title then grey date; on phones the "Coming up" date sits under the title so titles keep the whole row.

## Round 4 (redesign.5): design-critique fixes
Last CSS block in `styles.css` ("round 4") plus small JS changes. Two approved behaviour changes, everything else front end only; Home and Bills count definitions untouched.
- **Phone "+ New task"** (dock) opens a bottom sheet (`#nsheet`, `openNewTask` in `kanban.js`): 16px autofocused title, stack picker (filtered stack, else first), status picker (To Do), Add / Enter, Esc / scrim / swipe-down cancel, kept above the iOS keyboard (`visualViewport` in `core.js`), same `addTask` path, toast with Open. Desktop `N` and the inline "+" are unchanged.
- **Phone Kanban** shows one column at a time: per-stack scroll-snap row of ~86vw columns with To Do / In Progress / Done tabs and counts; card drag between columns still works with horizontal edge auto-scroll. Desktop lanes unchanged.
- **Gradient contrast**: white text kept; deeper stop under the text, bloom top-right, soft dark radial scrim; captions 13px/500; item-header eyebrow fixed.
- **Bills on phone**: stacked rows list, timeline opens at today's month, no orphan middle dot (non-breaking dot).
- **Tap targets**: 40x40 hit areas on touch (`::after` where the visible size must stay), card priority bars non-interactive on touch.
- **Labels**: one `--lbl` colour token (>= 4.5:1 light and dark), 11px minimum; readable breadcrumb separator; real 2px focus outlines on Home tiles, item header title and search; timeline Today is a black pill over a red line and the line is masked under outside bar labels; Tracker notes wrap (textarea) and the Note column width bug is gone; search empty copy differs for touch; phone menu shows matches while typing; page block X became a block options menu (undo kept); dialogs trap Tab; stack colour is id-hashed; "Due in 7 days" fits one line on phone.
- **Tokens**: font sizes `--fs-2xs..--fs-3xl` (8 steps), radii `--r-s..--r-2xl` + `--r-pill`, stray shadows folded into `--shadow` / `--shadow-lift`.
