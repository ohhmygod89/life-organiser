# Life Organiser — working rules

- Versioning: SemVer, currently betas of the first version (`1.0.0-beta.N`). Bump `VERSION`, add a CHANGELOG entry, `python3 build.py`.
- Never commit personal data. The repo and GitHub Pages are public; Pages runs demo mode with fictional data only.
- **Before every release:**
  1. `python3 build.py --local && node test/smoke.js && node test/review.js` — all must pass; look at the screenshots in `test/shots/`.
  2. An independent test by a separate agent on **Sonnet 5.5 at high effort** (unless the user names another model). It tests the built app on iPhone 13 emulation and desktop against the user's recent requests and reports issues. Fix blockers and majors, then re-test, before releasing.
- The user mainly uses iPhone Safari: check for page overflow, input zoom (fields ≥ 16px on touch), safe-area insets.
- Release: commit `release: vX`, push to `main` (Pages deploys and tags from `VERSION`), then republish the private app.
