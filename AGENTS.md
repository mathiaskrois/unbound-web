# Repository map

This is the independent unbound-web website repository, grouped locally under Git/krois/. Shared publishing is owned by sibling krois-site.

- Check git status and preserve existing work before editing.
- Public source is under unbound/; browser behavior is covered by tests/intro*.spec.js and tests/landing.spec.js.
- npm run build produces dist/; source changes must preserve the public /unbound/ URL prefix.
- Run focused checks; do not repeat the full browser suite without a relevant change or failure.
- Publish by recording the verified source SHA in krois-site/releases.json, then deploy that repo.
- Do not add app code, credentials, scraped private materials or browser answers.
- Tests run locally only (`npm test`, ~1.5 min); CI only builds. Never rely on or wait for GitHub browser runs.
- Verify visual and Safari-specific changes in real Safari where possible: Playwright WebKit differs from Safari 26 (it missed a negative-scale bug in CSS `tan(atan2())`).
- Story pages: one engine (`story.js`) with per-page pose tables; devices render in 3D (`devices-3d/`) with CSS devices as fallback. Never give a device element `opacity` or `view-transition-name` (both flatten 3D); write styles only when they change; keep the `stage-pending` reveal gate and the intro-playing render pause.
- Design direction (chosen by the owner): aurora / sound with an Apple-quiet opening, system SF type, no web fonts. Extend it rather than replace it.
