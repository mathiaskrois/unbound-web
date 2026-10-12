# Repository map

This is the independent unbound-web website repository, grouped locally under Git/krois/. Shared publishing is owned by sibling krois-site.

- Check git status and preserve existing work before editing.
- Public source is under unbound/; browser behavior is covered by tests/intro*.spec.js and tests/landing.spec.js.
- npm run build produces dist/; source changes must preserve the public /unbound/ URL prefix.
- Run focused checks; do not repeat the full browser suite without a relevant change or failure.
- Publish by recording the verified source SHA in krois-site/releases.json, then deploy that repo.
- Do not add app code, credentials, scraped private materials or browser answers.
