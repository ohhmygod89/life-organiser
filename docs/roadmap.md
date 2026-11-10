# Roadmap and ideas

## Data privacy (agreed 9 Nov 2026)
- [x] **Stage 1 — Export / import** (1.0.0-beta.11). One JSON file, optionally encrypted in the browser (PBKDF2-SHA256 600k → AES-256-GCM). Import previews, then Merge (newer `updated` wins) or Replace everything; undo and "Undo last import".
- [ ] **Stage 2 — On-device data.** The Pages site offers Demo or "My data, on this device only" (IndexedDB), works offline, installable to the Home Screen, asks for persistent storage.
- [ ] **Stage 3 — Encrypted sync.** Google sign-in (Facebook later) via Supabase. Every record encrypted on the device with a key from the user's passphrase; the server stores ciphertext plus id and timestamps only. One-time recovery key. PocketBase on the Synology can replace Supabase later without changing the encryption.

## Next
- [ ] Coupon/renewal dates can create a Kanban task automatically.
- [ ] Calendar view of everything with a date (tasks, collection dates, tracker entries).

## More item types to consider
- **Journal:** one dated entry per day, with a calendar strip.
- **Bookmarks:** links with titles, tags and a "read later" tick.
- **Contacts:** people with phone, email, birthday (birthdays feed Home).
- **Documents register:** where each important document lives (passport, wills, insurance), with expiry dates.
- **Habits:** daily tick grid with streaks.
- **Goals:** a goal with milestones and a progress tracker.
- **Budget:** monthly categories with planned vs actual.

## Nice-to-haves
- Collection views: cards and calendar, filters saved per collection.
- Note editor: live preview, `[[` autocomplete, images.
- Drag cards from a Kanban into a Note as links.
- Export a collection to CSV.
