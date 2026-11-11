# Changelog

Versions follow [Semantic Versioning](https://semver.org). Everything before 1.0.0 is a beta of the first version.

## [1.0.1-beta.3] - 2026-11-11
### Changed
- Desktop: when the sidebar is hidden, only its show/hide icon shows. Point at it to open the sidebar; click it to keep the sidebar open.
- No browser typing suggestions in any box.
### Fixed
- After dragging a card, a copy of it could stay floating over the board even though the card had moved. It is now cleared as soon as the drag ends.

## [1.0.1-beta.2] - 2026-11-11
### Changed
- Desktop sidebar hides itself to a thin strip of icons and opens when you point at it (or tab into it). The button at its top keeps it open; [ does the same.
- Stack names are larger.
- Opening a task no longer puts the cursor in its title.
### Added
- Press Delete (or ⌘⌫) on a highlighted menu item to delete it, with the usual confirmation and Undo.
### Fixed
- A card could stay stuck mid-drag if the mouse was released outside the app; the drop now finishes.
- Hiding the sidebar no longer leaves a stray button over the page.

## [1.0.1-beta.1] - 2026-11-11
### Changed
- New look, inspired by the Pulse design: light and dark themes, soft gradient cards with white text, black pill controls, dot-matrix charts and the iPhone system font.
- Home: gradient stat tiles (right-click or double-tap a tile to pick its colour), a lighter heading, and Pulse-style lists.
- Sidebar: a white panel with compact rows, black count badges and folder section labels. The show/hide button now sits in the sidebar and the top bar is gone. The version is in the card at the bottom.
- Kanban: stack names sit on the page background; column headers have no task counts; Include filters are chips like the others; pinned cards are tinted by priority (red, orange, grey). Unpinning puts a card at the top of the unpinned cards.
- View menu: Kanban, Gantt, List, Archive.
- Phone: a floating dock (☰, + New task, Filter); Kanban shows one column at a time with tabs; Bills list shows stacked rows; the Bills timeline opens on this month.
- Right-click menus open where you click.
- Bigger tap targets on phone, stronger text contrast and clearer keyboard focus rings throughout.
### Added
- Phone: + New task opens a small panel (name, stack, status) above the keyboard.
### Fixed
- The item name field is only as wide as its name.

## [1.0.0-beta.29] - 2026-11-10
### Added
- Timeline: drag tasks up and down to put them in your own order (desktop: by the title; phone: press and hold a row). ⌥↑ / ⌥↓ does the same from the keyboard. The order is kept per stack.
### Changed
- Timeline bars all look the same: one solid bar from the first date to the last; a task with a single date is a one-day bar. No fading, no outlines.
- Phone: each task's bar and title sit on one line, with no background behind the title.
- Pinning isn't shown or offered in the Timeline (it belongs to the board).
### Fixed
- The Today line no longer shows through folded stacks.

## [1.0.0-beta.28] - 2026-11-10
### Added
- Timeline view (View › Timeline; on a phone, in the Filter panel): a Kanban's tasks on a calendar, grouped by stack, with the same filters as the board. A task with a start and due date is a bar; a due date alone is a diamond; a start alone is a bar that fades out. To Do bars are outlined, In Progress filled, Done muted with a tick, and overdue tasks get a red end.
- Week, Month and Quarter zoom, a Today line and a Today button. Stacks fold away, and tasks with no dates wait in a “No dates” tray.
- Desktop: drag a bar to move it, drag either end to change that date (Esc cancels), or drag a task from “No dates” onto the timeline to give it a due date. Every change can be undone. Right-click a bar for the card menu.
- Keyboard: ↑ ↓ move between tasks, Enter opens one, ⌥ ← → moves its dates, ⌥ ⇧ ← → moves only the due date.
- Phone: tap a bar or its title to open the task, double-tap for the card menu.
- Tasks have an optional Start date, above Due in the task window. A start can't be after the due date: setting a later start moves the due date with it, and an earlier due date moves the start.
- Cards show the range, e.g. “12 – 16 Nov 26”, or “From 12 Nov 26” with only a start. Columns can be sorted by start date.
### Changed
- The demo's sample data was refreshed to include start dates (the demo resets once).

## [1.0.0-beta.27] - 2026-11-10
### Changed
- Phone: Board / List / Archive moved into the Filter panel (a View group at the top), leaving one floating Filter button beside the menu button. Picking a view closes the panel.

## [1.0.0-beta.26] - 2026-11-10
### Changed
- Desktop: right-click opens the hidden menus: cards, a column's sort menu (title or empty space) and a stack's options (its header). Phone: double-tap does the same.
- Phone: View and Filter are round icon buttons in a row beside the menu button, bottom right; Filter shows a count badge when filters are on.

## [1.0.0-beta.25] - 2026-11-10
### Changed
- Priority is High, Medium or Low (no "none"); new tasks start as Low, and tasks without a priority became Low.
- New priority icons: three thin outlined bars in the priority's colour, with 1, 2 or 3 filled.
- Task window: a divider under every subtask again, with even spacing.
- Phone: View comes before Filter, centred in the space beside the menu button.
### Fixed
- Phone card titles no longer wrap early: space for the pin is only kept on pinned cards.

## [1.0.0-beta.24] - 2026-11-10
### Added
- Double-tap (or double-click) a column title or its empty space to sort it once: by priority, due date, title or newest. Undo puts it back.
- Underline in the text editor (⌘U), saved as ++text++ in Raw.
### Changed
- Columns are no longer forced into priority order: drag cards anywhere, in any column or stack, and they stay where you drop them. Pinned cards still stay above the rest. Changing priority no longer moves a card.
- Flag list order: Waiting, On hold, Needs decision, Blocked.
- "Edited …" sits under the item title.
- Phone: Filter and View float in the middle at the bottom.
- Text editor: the item-link button is icon-only.
- Task window: no divider lines between subtasks; the reason box is taller and no longer clipped; the Add subtask line lines up with the subtasks.
- No-priority bars have a thinner outline.

## [1.0.0-beta.23] - 2026-11-10
### Changed
- Phone: double-tap a card for its menu (a single tap opens it, holding drags). The hold menu and its haptic tick are gone, and no menu item is pre-highlighted.
- Phone: Filter and View float at the bottom, beside the menu button; the filter panel opens above them and closes when you tap elsewhere.
- A card shows only its own flag; subtask flags stay on the subtasks and show the flag name (the reason is in the task window).
- No-priority bars are fainter, so they don't look like Low.
- The page header drops the type word ("Page", "Kanban"); the icon says it.
- Text blocks: Editor / Raw sits on the right; formatting (B, I, S, code) comes before the link buttons.
- Send buttons only appear once you tap into the box.

## [1.0.0-beta.22] - 2026-11-10
### Added
- Card menu (hold on phone, right-click on desktop) has Delete, with Undo.
- Haptic tick when the card menu opens on a phone (iPhone Safari 18 or later).
### Changed
- Hold a card, and if you then move your finger, the menu closes and the card drags.
- Board / List / Archive is now a View dropdown. On a phone, the filter groups sit behind a Filter button that shows how many filters are on.
- Phone: the top bar is gone (it repeated the page header); the folder name shows in the header instead.
- Checklist header is one compact row: count, Hide done, and a ••• menu for Untick all and Clear done.
- Picking the flag a task already has changes nothing.
### Fixed
- No-priority outline bars now show on phones without tapping.
- The stack name box is no longer cut off on the left and has no blue outline.

## [1.0.0-beta.21] - 2026-11-10
### Added
- Phone: press and hold a card for its menu: Pin or Unpin, Move to another column, Duplicate, Open. Desktop right-click shows the same menu.
- Send buttons at the end of the add boxes (subtasks, updates, checklist items, new tasks), so Enter isn't needed.
- Text editor: a labelled "Item link" button near the start of the formatting bar inserts a link to another item.
### Changed
- Phone task window sits near the top, leaving room below to tap out of it; it keeps the box you're typing in, and what you just added, in view.
- "Waiting on someone" is now "Waiting", and its box is labelled "Reason" like the other flags.
- No priority shows as outline bars, and you can tap the bars to set one.
- Phone cards: the ⇄ button and the faint pin are gone (both are in the hold menu); pinned cards still show a pin.
- Phone: Board / List / Archive is an even three-way control; filter groups no longer cut off their last chip; the stack name box looks like a proper text box.
- Neutral colours for the checklist actions, send buttons and Add block buttons.

## [1.0.0-beta.20] - 2026-11-10
### Added
- Text blocks have a rich editor with a formatting bar: text style (Normal, Headings), bold, italic, strikethrough, code, bulleted, numbered and checklist lists, quote, web links, links to items and clear formatting. "Write" is now "Raw" (the markdown underneath).
- Cards: click a title or subtask on desktop to edit it in place; click the priority bars to pick a priority from an icon menu.
- Right-click a card: Duplicate, then click any column in any stack to drop the copy there (Esc cancels).
- Stack names are edited in place.
### Changed
- Every menu item can go anywhere: Kanban, Bills and Trackers can sit in folders and mix with pages.
- Kanban: Board / List / Archive sit at the right end of the filter row; + Stack is in the Stacks group; the grey bar by stack names is gone.
- New item: Page on the first row, the others below; the name box is ready to type.
- Right-click does nothing except where the app offers a menu (menu items, cards); text fields keep copy and paste.
### Fixed
- Dragging menu items no longer offers "Create split view", and no text gets selected while dragging.

## [1.0.0-beta.19] - 2026-11-09
### Added
- Page: a new item built from blocks. Add, remove, rename and reorder Text, Checklist and Table blocks.
- Kanban: one Kanban item holds your stacks (Home, Work, …). Add a stack with + Stack, rename or remove one from its ••• menu. Archive is a tab inside the Kanban.
- Right-click an item or folder in the menu for Rename, Move and Delete (on a phone, use ••• on the open item).
- Folders are back, below the custom items. Drag folders, and drag pages into, out of and within folders.
### Changed
- Every existing note, checklist and table is now a Page holding it as its first block; every old board is now a stack in the Kanban.
- Columns always sort by priority: pinned first, then High, Medium, Low, none. Drag to reorder within a group; new, newly pinned, re-prioritised and returned-from-Done cards go to the bottom of their group.
- Card due date sits at the bottom right; the notes icon is gone; the add box is at the bottom of the column.
- Kanban filters in three separate groups (Show, Stacks, Include), with Done and Backburner as toggles. Board / List / Archive tabs stay put.
- New item always starts blank (no templates). All icons are one neutral colour. The top-right ••• menu is gone.
- Demo item names are in Title Case.
### Fixed
- Folder assignments are no longer cleared when the menu loads.

## [1.0.0-beta.18] - 2026-11-09
### Added
- What's new: hover the version number (tap on a phone) to see the latest changes.
- Done column on phones is hidden by default, with a Done / Show Done switch (remembered per device).
### Changed
- Sidebar in two groups: Custom (All tasks with every Kanban and the Archive under it, Bills, Trackers) and General (Notes, Tables, Checklists). Folders removed; your order is kept.
- Cards: the pin button replaces the done tick (move to Done by drag or ⇄); completed subtasks hidden; due date on one line at the bottom left; title and flag keep clear of the corner buttons.
- Pinned cards can only be moved among pinned cards.
- Dragging: cards make room as soon as you reach them.
- "Back Burner" is now "Backburner"; "Collection" is now "Table".
- Top bar: "+ New" and "Shortcuts" removed (New item is in the sidebar, shortcuts in the ••• menu); demo badge moved under the version.
- Phone task window has smaller gaps; desktop subtasks indented more.
### Fixed
- After dragging a task, the first click on a card now opens it.
- Sharper ⇄ icon and due dates on iPhone.

## [1.0.0-beta.17] - 2026-11-09
### Added
- Pin tasks from the task window: pinned tasks sit at the top of their column with a pin icon and a faint grey tint.
- Subtasks in the task window: tap the flag (or the faint flag button) to choose a flag; × deletes the subtask, with Undo.
- Needs decision asks for a reason, like Blocked and On hold.
### Changed
- Cards: flag under the title, subtasks indented with open ones first, no subtask counter, due date bottom right in full (dd mmm yy) with "In 6d"/"overdue" added when due within a week.
- Due dates elsewhere show the full date plus how far away.
- Kanbans (categories) are neutral grey everywhere, including the lane tab and ticked subtasks.
- Lane headers break the count down: open · to do · in progress (on a second line on phones).
- Flag short name "Decision" is now "Needs decision"; completed subtasks can't carry a flag.
- Dragging: the card lifts with a shadow and its old spot becomes a quiet empty slot.
- The ⇄ move button is touch-only, sits beside the due date (or under the tick when there's no footer).
- "Every Kanban, stacked" heading removed.
### Fixed
- Reordering pinned cards; pin message wording; due date shown once in the task window; category names cut off on phones.

## [1.0.0-beta.16] - 2026-11-09
### Fixed
- Task window: pausing while typing redrew the window, jumped the cursor to the start and (on iPhone) dropped and reopened the keyboard so later taps landed in the wrong place. The window no longer redraws while you're typing in it.
- Taps lining up on iPhone: the page behind the task window and dialogs is locked in place, the window sits above the keyboard, and the view is put back when the keyboard closes.
- Changing a flag clears the old Who?/Why? text.
### Changed
- All Kanbans (categories) use one standard colour; no Colour option for Kanbans.
- Medium priority is orange, clearly different from High.
- Blocked and On hold ask "Why?" (Waiting still asks "Who?"), on tasks and subtasks. Subtask chips on cards show just the who or why, with more room.
- Category is now the first row of the task details; the title sits beside the close button.
- Task window is more compact, with bigger gaps around it on phones.
- Done subtasks hide their flag; interrupted swipe-down snaps the window back.

## [1.0.0-beta.15] - 2026-11-09
### Fixed
- Safari stuck zoomed in (page cut off on the right, menu cut off at the top): the app snaps back to 100% on load and whenever it finds itself zoomed, and pinching out is allowed when zoomed.
- Column "+" opened the add box off-screen below the cards; it now opens at the top of the column, new tasks go to the top, and several in a row keep their typed order.
- Side menu stayed open behind dialogs, with the menu button covering Save; it now closes when a dialog opens.
- Long "Who?" on a subtask flag spilled out of the card; it now cuts off with "…".
- A fast flick could jump two columns; every swipe now moves at most one column.
- Dragging a card near the screen edge slid the board sideways; while holding a card the board only scrolls up and down.
### Changed
- Phone task window: pull the top bar down to close it.
- Dialog buttons stay visible at the bottom of tall dialogs.
- No keyboard-shortcut items in the ••• menu on touch screens; "Open" links in lane headers not underlined; the drop placeholder only shows in empty columns.
- Release process: every release is tested by an independent Sonnet 5.5 (high) agent before it goes out.

## [1.0.0-beta.14] - 2026-11-09
### Fixed
- Phone: the page was wider than the screen in Safari, cutting off the right edge (menu button, Open links, column + buttons) and shifting the menu. The closed menu no longer sits off the right edge, and the page can't scroll sideways.
- A subtask's flag no longer appears twice on a card when it's the flag shown at the top.
### Changed
- Subtask flag chips line up under the subtask text.
- Keyboard-shortcut hints are hidden on touch screens.
### Added
- `test/review.js`: release check of every page on phone and desktop (overflow and script errors), run before each release.

## [1.0.0-beta.13] - 2026-11-09
### Changed
- Columns are now To Do, In Progress, Done (Back Burner unchanged). Tasks that were in Upcoming move to To Do.
- A card shows the most serious flag among the task and its open subtasks (Blocked, then Waiting, Needs decision, On hold). The task window says when the card's flag comes from a subtask.
- Updates list oldest to newest, with the add box underneath.
- Phone task window floats with a gap on every side; tap outside it to close.
- The menu button stays visible while the menu is open and turns into a close button.
- Touch drag: once a card is picked up, only the card moves; the board no longer scrolls under your finger. Edge auto-scroll is gentler.
### Fixed
- No zooming anywhere: pinch, double-tap and the automatic zoom when tapping a text box are all blocked.
### Removed
- The tick logo next to the app name.

## [1.0.0-beta.12] - 2026-11-09
### Added
- Subtasks can carry a flag too (for example Waiting on someone, with who).
- Floating menu button at the bottom right on phones.
- Demo: three Kanbans with 2–5 tasks in every column and a mix of priorities, dates, flags and subtasks.
### Changed
- Priority shows as signal bars (one, two or three) instead of exclamation marks.
- Cards show their subtasks in every view; flag chips stay on one line ("Waiting · Passport office").
- Task window redesigned: one column, title, a Status / Priority / Due / Flag list, notes that grow as you type, subtasks with their own options, updates and a footer. Opens as a bottom sheet on phones.
- Drag and drop: drop anywhere in a column, not only under the last card.
### Removed
- Swipe to open the menu (Safari uses the edge for Back).

## [1.0.0-beta.11] - 2026-11-09
### Added
- **Export** from the ••• menu: everything in one file, encrypted with your passphrase (default) or plain.
- **Import**: shows what's in the file, then Merge (keeps the newer version of each record, deletes nothing) or Replace everything. Undo straight after, plus "Undo last import" in the menu.
- "Last backup" shown in the menu, and a reminder when there's been no backup for 7 days.
### Removed
- "Copy backup (JSON)", replaced by Export. Old copied backups can still be imported.

## [1.0.0-beta.10] - 2026-11-09
### Changed
- Every Kanban now uses the same layout as the stacked board: same column size, compact cards, + in each column header.
- Phone: two columns fit across the screen; swiping moves one column at a time.
- Horizontal scroll bars under boards are hidden.
- Swipes that start at the very edge of the screen are left to Safari (back / forward). Open the menu by swiping right while on the first column.

## [1.0.0-beta.9] - 2026-11-09
### Added
- All tasks opens as a **stacked board**: one band per Kanban, clearly labelled, sharing one sideways scroll so the columns line up. Drag a card to another column or another Kanban. List view is still one tap away.
- Move button on every card: pick a column without dragging.
- Phone: swipe sideways anywhere on the screen to move between columns; swipe right from the left edge (or past the first column) to open the menu, swipe left to close it.
### Fixed
- Ticking a checklist item no longer jumps the board back to the first column.
### Changed
- Phone columns are narrower so the next column peeks in, and the board runs to the screen edge.

## [1.0.0-beta.8] - 2026-11-09
### Added
- GitHub repository, build script and GitHub Pages deployment on every push to `main`.
- Demo mode: outside claude.ai the app runs on fictional sample data stored in the browser, with a "Demo" badge and a Reset demo data option.
- Version number shown under the title in the sidebar and in the options menu.

## [1.0.0-beta.7] - 2026-11-06
### Added
- **Bills** item type: one page listing each recurring bill (active, asset, category, institution, start, end, period, amount).
- Yearly timeline with active terms, due dates, a today line and monthly totals.
- Paid ticks that record the paid date and amount; payments list for overdue, next 60 days and recently paid.
- Update menu: renew / extend, switch provider (keeps history), edit, end, delete.
- Home: "Bills due in 30 days" tile; bills appear in Coming up.

## [1.0.0-beta.6] - 2026-11-05
### Added
- Life Organiser: sidebar of folders and items, each item with a type: Kanban, Note, Collection, Tracker, Checklist.
- Home, All tasks, Archive, global search, keyboard shortcuts.
- Styling aligned with the Ticker Wall dashboard.
### Changed
- Life Board boards and tasks migrated in as Kanban items.

## [1.0.0-beta.5] - 2026-11-04
### Fixed
- Quick-add no longer duplicates or merges tasks.
- Keyboard focus stays inside the task window and returns to the card.
- Light-mode contrast for chips, priority marks and controls.
### Added
- Undo for done, move, delete; keyboard shortcuts; compact task window; larger touch targets.

## [1.0.0-beta.4] - 2026-11-03
### Changed
- Apple / iOS / macOS styling.

## [1.0.0-beta.3] - 2026-11-03
### Added
- Checklist items visible and tickable on cards; hide boards.
### Fixed
- Tick alignment and equal column widths.

## [1.0.0-beta.2] - 2026-11-03
### Added
- Centred task window, button pickers instead of dropdowns, Done column limited to the newest 5, Overview dashboard, yearly Archive.

## [1.0.0-beta.1] - 2026-11-03
### Added
- Life Board: Kanban with a board per category, columns Upcoming / To Do / In Progress / Done / Back Burner, drag and drop, cards with notes, checklist, dated updates and status flags, synced across devices.
