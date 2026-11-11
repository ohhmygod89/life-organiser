# Life Organiser — working rules

- Versioning: SemVer, currently `1.0.1-beta.N`. Bump `VERSION`, add a CHANGELOG entry, `python3 build.py`.
- Never commit personal data. The repo and GitHub Pages are public; Pages runs demo mode with fictional data only.
- **Before every release:**
  1. `python3 build.py --local && node test/smoke.js && node test/review.js` — all must pass; look at the screenshots in `test/shots/`.
  2. Test it yourself: scripted Playwright runs of every requested change on iPhone 13 emulation (touch) and desktop, plus a look at the screenshots. Fix what you find before releasing.
  3. A separate Sonnet 5.5 (high effort) test agent only when the user asks for it.
- The user mainly uses iPhone Safari: check for page overflow, input zoom (fields ≥ 16px on touch), safe-area insets.
- Release: commit `release: vX`, push to `main` (Pages deploys and tags from `VERSION`), then republish the private app.
