# Changelog

Versions follow [Semantic Versioning](https://semver.org). Everything before 1.0.0 is a beta of the first version.

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
