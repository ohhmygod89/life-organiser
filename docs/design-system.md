# Design system

Matches the Ticker Wall crypto dashboard (Apple web / iOS / macOS). Tokens live at the top of `src/styles.css`.

- **Font:** -apple-system / SF Pro, Inter as the fallback on Windows. Base 15px, letter-spacing -0.016em, tabular numbers.
- **Colours (light / dark):** bg #f5f5f7 / #000, panel #fff / #1d1d1f, fill #e8e8ed / #2c2c2e, line #d2d2d7 / #424245, text #1d1d1f / #f5f5f7, muted #6e6e73 / #98989d, accent #0071e3 / #2997ff, up #1e7b36 / #30d158, down #d70015 / #ff453a, warn #b25000 / #ff9f0a. Item colours use Apple system colours (blue, indigo, violet, rose, red, orange, amber, green, teal, slate).
- **Shapes:** capsules (980px radius) for segmented controls, pills and chips; panels 18px; dialogs 22px; cards 14px.
- **Components:** frosted 48px top bar and frosted sidebar; capsule segmented control (`.seg`); iOS switch (`.switch`); blue pill button (`.pill`); text links (`.link`); dark toast with blue Undo; macOS-style pop-up menus (`openMenu`); centred dialogs (`openModal`).
- **Type icons:** 22px rounded squares in the item colour (Kanban blue, Note amber, Collection green, Tracker indigo, Checklist teal by default).
- **Charts:** single 2px accent line, step line for rates, recessive grid, end marker, hover crosshair + tooltip, no dual axes.
- **Accessibility:** focus rings, keyboard shortcuts, inert background behind dialogs, reduced-motion support, 24px+ targets (bigger on touch).
