# Data model

Storage is the artifact's built-in database (claude.ai). Access rule: read and write need Editor (admin) level, so only the owner can see it.
All database access goes through the `Store` object in `src/core.js`. To move to PocketBase on the Synology, replace `Store` (connect, watch, watchDoc, run); nothing else talks to the database.

## Collections
### folders/{id}
`name, order, created, updated`

### items/{id}
Common: `type ('kanban'|'note'|'collection'|'tracker'|'checklist'), name, folderId ('' = Unfiled), order, color (key of COLORS or empty for the type default), created, updated`
- kanban: `hidden` (bool, hides from All tasks and Home)
- note: `body` (markdown-style text)
- collection: `fields: [{id, name, type: text|number|currency|percent|date|select|checkbox|url, options?: [..], home?: bool}]`, `sort: {field, dir:'asc'|'desc'} | null`
- tracker: `unit, decimals, step (bool), points: [{id, date 'YYYY-MM-DD', value Number, note}]`
- checklist: `entries: [{id, text, done}]`, `hideDone`
- bills: `bills: [{id, active, asset, category, institution, start, end, period (months: 1|2|3|6|12), amount, ref, notes, paid: {dueDate: {date, amount}}, history: [{start, end, institution, amount, ref}], stopped, created, prevId}]`
  - Due dates: annual bills with an end date are due on the end date; everything else every `period` months from `start` (first due one period after start), up to `end`.
  - `created` = the date tracking began; due dates before it show as "Before tracking" (hollow), never overdue.
  - `stopped` = date a bill was ended or switched away; no due dates after it (annual renewals on that date are dropped).
  - Renew pushes the current term into `history` and moves start/end forward. Switch provider stops the old bill and adds a new one with `prevId`.

### tasks/{id}  (Kanban cards)
`boardId, col (upcoming|todo|doing|done|backburner), pos, title, notes, due 'YYYY-MM-DD', priority (''|low|med|high), flag, flagWho, checklist [{id,text,done}], log [{id,t ISO,text}], doneAt, prevCol, created, updated`
Done tasks from earlier years are hidden from boards and shown in Archive.

### rows/{id}  (Collection rows)
`itemId, pos, values: {fieldId: value}, created, updated`

### meta/settings
`flags: [{id, label, color, who?}]` shared by every Kanban.

## Ids
New ids are 15 lowercase letters/digits (PocketBase's default format). The four migrated boards keep their old ids (`personal`, `personal-aus`, `work`, `business`) and tasks keep `s01`–`s24`; remap these if PocketBase rejects them.

## Home rules
- Coming up: open tasks due within 14 days (or overdue), plus collection rows whose date field has "Show on Home" ticked and falls within 30 days (or up to 7 days past). A row drops off once any of its tick-box fields is ticked (e.g. Used).
