# Life Organiser

A personal, Notion-style organiser in one HTML page. The sidebar holds **items** grouped into **folders**, and every item has a **type**.

**Live demo (sample data):** https://ohhmygod89.github.io/life-organiser/ — rebuilt on every push to `main`.

| Type | What it's for |
|---|---|
| Kanban | One-off tasks: columns, drag and drop, task window with notes, checklist, dated updates, status flags, undo |
| Note | Markdown-style pages with `- [ ]` checkboxes, `[[Item name]]` links and backlinks |
| Collection | A table with fields you choose (text, number, money, percent, date, choice, tick box, link) |
| Tracker | Dated numbers with a chart (step line for interest rates) |
| Checklist | Reusable tick lists |
| Bills | Recurring bills and renewals on a yearly timeline, with paid ticks and provider history |

Plus Home (summary, Coming up, trackers), All tasks, Archive and search. Press `?` in the app for shortcuts.

## Where data lives
- **In claude.ai** (the real app): the artifact's private database. Only the owner can read or write it.
- **Anywhere else** (GitHub Pages, opening the file locally): **demo mode** with fictional sample data saved in that browser only. No personal data is in this repository.

All storage goes through the `Store` object in `src/core.js`, so a self-hosted backend (e.g. PocketBase) can replace it later.

## Build
```sh
python3 build.py            # dist/life-organiser.html (claude.ai) and dist/index.html (Pages)
python3 build.py --local    # test/local.html for offline testing (needs: npm i sortablejs@1.15.2)
node test/smoke.js          # opens every view in demo mode; fails on any page error (needs Playwright)
```

## Release a version
1. Bump `VERSION` (SemVer; betas use `1.0.0-beta.N`) and add a `CHANGELOG.md` entry.
2. `python3 build.py --local && node test/smoke.js`
3. Commit `release: vX.Y.Z`, tag `vX.Y.Z`, push `main` and the tag. GitHub Pages redeploys automatically.
4. Publish `dist/life-organiser.html` to the claude.ai artifact (same link) so the real app matches.

## Layout
```
src/styles.css        design tokens and all styles
src/shell.html        page skeleton
src/core.js           store, state, routing, sidebar, menus, dialogs, Home / All tasks / Archive / Search
src/demo.js           demo database with sample data
src/types/*.js        kanban, note, collection, tracker, checklist, bills
docs/                 data model, design system, roadmap
build.py · VERSION · CHANGELOG.md · test/smoke.js
```
