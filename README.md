# Unbound promotional website

Independent promotional website for the Unbound app, published at `https://krois.dk/unbound/`. The iPhone/Watch app is a separate repository and is not built or deployed by this website.

## Project layout

| Path | What it is |
| --- | --- |
| `unbound/index.html`, `unbound/experience/` | The two story pages (home and the Apple Watch experience). |
| `unbound/privacy/`, `unbound/terms/`, `unbound/support/` | Policy and support pages. |
| `unbound/assets/unbound.css` | Design system shared by every page: tokens, type, glass navigation, buttons, footer, article layout. |
| `unbound/assets/story.css`, `story.js` | Story-page layout and engine: aurora, waveforms, scroll choreography, device stage, motion control. |
| `unbound/assets/devices.css`, `unbound/partials/device-canvas.html` | The CSS iPhone and Apple Watch (fallback and no-JavaScript composition), included in both story pages at build time. |
| `devices-3d/devices-3d.js` | Source of the real-time 3D devices; bundled with three.js into `assets/devices-3d.js` by the build. |
| `unbound/assets/intro.css`, `intro.js`, `intro.mp4`, `watch-icon.webp` | The once-per-session homepage entrance. |
| `scripts/build-site.mjs`, `scripts/preview.mjs` | Build into `dist/` (partials, 3D bundle, asset hashes) and the local preview server. |
| `tests/` | Playwright browser tests (`landing.spec.js`, `intro.spec.js`, `intro-motion.spec.js`). |

## Local preview

Run `npm run preview` from this directory, then open `http://127.0.0.1:8080/unbound/`. It builds `dist/` and serves it at the public `/unbound/` mount with Node, so shared partials and asset versions match production.

## Story pages

The homepage and `unbound/experience/` are scroll stories in one design system. `unbound.css` holds the tokens (aurora palette of violet, mint and coral; minimum text sizes of 11 px labels and 12 px small print), Apple-style system type (SF Pro on Apple devices, no web fonts), the glass navigation bar, buttons and footer, and the policy/support article layout; every page loads it. `story.css` lays out the story sections, and `story.js` runs them; each page declares only its own device poses (`data-page` on `<body>`).

Each story opens Apple-quiet: one centred headline on near-black, with the iPhone (home) or the Apple Watch (experience) rising beneath it. As you scroll, the headline blurs away and a living aurora blooms: a low-resolution WebGL shader (domain-warped noise in indigo, violet, mint and coral) that follows the cursor and shifts mood per section. Sound is the motif: canvas waveforms (hero journey scrub, cards, footer) that react to scroll speed, an equaliser and chapter scrubber in the navigation, a typing library search, speed chips that change a waveform's tempo, a draining sleep-timer ring and dropping bookmark pins. Cards are frosted glass with a cursor light; buttons are magnetic. The home journey is a sticky three-step section (import on iPhone, transfer to Watch with Pro, listen offline) during which a "Sending to Watch" file chip flies along a dotted arc from phone to watch and labels ride on the devices. The experience page adds two split chapters, the interactive walkthrough (sample file, no real transfer), the listening tools and the Pro invitation. Policy and support pages share the navigation and a still aurora glow.

The devices are real-time 3D models rendered with three.js (WebGL): `devices-3d/devices-3d.js` builds an iPhone 16 Pro (titanium body, keys, Camera Control, antenna bands, cover glass) and an Apple Watch Series 10 (aluminium case with rounded flanks, knurled crown, side button, display, and a plum sport band looping around an invisible wrist) at the hardware's proportions, lit by a studio environment with key and rim lights and soft shadows. The phone shows the Library capture with the branding patch; the watch draws its Now Playing screen live. `npm run build` bundles three.js and the models with esbuild into `assets/devices-3d.js` (about 150 KB gzipped) and stamps its URL in `story.js` with a content hash. Both story pages include the device markup from `unbound/partials/device-canvas.html` in a fixed device layer; `story.js` loads the 3D module on demand and writes every pose to both renderers, and the watch renders in a second pass so it always sits in front of the phone. Browsers without hardware WebGL (including software renderers such as SwiftShader), or a stage that is not ready within 3.5 s, use the CSS devices in `devices.css`; software renderers also get a still aurora gradient. Neither device may carry a `view-transition-name` or opacity, because both flatten CSS 3D; the cross-page view transition names the stage instead, and the phone dims its screen rather than fading.

Poses are offsets on the 540×680 device stage (CSS conventions, degrees) plus a whole-stage offset and an aurora mood. Each `[data-pose]` element holds its pose while it fills the middle of the viewport (`data-hold` overrides), and poses blend in between, following scroll through a spring. `story.js` scales the stage to the viewport (the fit is not done in CSS because Safari 26 resolves `tan(atan2())` with container units to a negative scale). Springs integrate in fixed 1/120 s steps, so motion is identical at any refresh rate; fine pointers tilt the devices; the devices swing in from depth after the intro. The stage stays hidden from the first paint (an inline `stage-pending` class, with a 5 s CSS failsafe) until its devices and screen are loaded, then fades in during the entrance, so a reload never shows a half-loaded or jumping device. Styles are written only when they change, so an idle page makes no DOM changes; nothing renders while the intro video plays. Phones get their own poses, with copy on solid glass cards and the devices above.

The system Reduce Motion preference is respected on load and when changed, and visitors can pause motion from the navigation: the aurora, waveforms, tilt and choreography then hold still. Content and a still CSS device composition work without JavaScript. The Watch player is an illustration based on the app's playback controls, not a captured Watch screenshot. The build stamps every local asset URL in the HTML with a hash of the file, so changed files are never served from a stale cache.

Brand assets come from the companion Unbound app repository:

- `Design/Previews/modern-library-dark.png` → `unbound/assets/library-dark.webp` (660px wide, WebP quality 88).
- `Design/Brand/unbound-logo-transparent.png` → `unbound/assets/app-icon.webp` (256px, WebP quality 95), `apple-touch-icon.png` (180px), `favicon-32.png`, and `favicon.ico` (16/32/48px). These exports preserve alpha around the rounded glass tile, with no black exterior matte or CSS corner clipping. Regenerate with `python Scripts/export-brand-assets.py --site ../krois/unbound-web` from the companion app checkout; requires Pillow.

The copy retains prelaunch availability. Replace the coming-soon labels with the confirmed App Store URL when the app is released.

## Homepage entrance

`intro.js` and `intro.css` show a once-per-session Watch-logo entrance. The round `watch-icon.webp` (480 px, for display at up to 240 CSS px) comes from the companion app's Watch AppIcon asset. A 120 Hz fixed-step damped spring handles landing and hover; the in-place transformation preserves velocity while aligning the icon’s inner symbol with the video. Background tabs suspend the animation clock. Entry by pointer, Enter, or Space starts unmuted video in the activation handler; rejected audible playback retries muted. Failures reveal the homepage. Skip, Escape, focus isolation/restoration, reduced motion, anchor links, and the no-JavaScript homepage remain supported. The prompt fades in after 1.5 visible seconds, once the logo has landed; early entry remains available. A decoded video frame starts the 180 ms icon dissolve and 550 ms expansion to full-screen framing. The MP4 starts 0.5 seconds into the original source, with audio trimmed identically. Playback continues during the 0.6-second final fade, starting at media time 4.0 seconds (the original 4.5-second animation endpoint). Portrait touch layouts up to 900 CSS pixels wide rotate the aligned artwork 90° anticlockwise in 350 ms. During the intro, viewport-fit=cover enables edge-to-edge layout; the original viewport setting is restored on completion. Mobile artwork uses 100lvh. Browser-tab framing centers the artwork and controls in the visual viewport, including its offset; standalone mode retains its full-height stage. An oversized black backing, hidden page siblings, and a black root prevent Safari from exposing the homepage beneath its translucent controls. Viewport/theme metadata are restored only after the final fade. The video’s original width fills the large viewport height, accepting cropping on tall phones. Controls stay upright; landscape and desktop playback stay upright. Viewport/orientation changes retarget framing over 350 ms without restarting playback. The prompt matches the site: a frosted-glass pill with a live equaliser and "Press to enter" ("Tap to enter" on touch screens) in system type with a shimmering aurora gradient; it rises and sharpens in when the logo has landed. A dark aurora (a blue core matching the logo, with drifting violet and mint) breathes behind the logo, and a pool of the logo's light lies beneath it, brightening as the logo lands and following its hover. The atmosphere fades to pure black before the video grows, so the video's black frame never shows. Skip and sound controls are glass pills; the sound control shows a speaker icon for its state.

The build versions every asset referenced from HTML automatically. `intro.js` loads `watch-icon.webp` and `intro.mp4` itself, so bump their `?v=` query strings in `intro.js` when replacing either file. Browser tests cover playback failures, early/repeated entry, focus, session bypass, media-time fading, frame-rate consistency, and tab suspension. Playwright's desktop/mobile WebKit profiles are engine tests, not physical iPhone Safari validation.

## Browser checks

```sh
npm ci
npx playwright install chromium webkit
npm test
```

Tests cover Chromium, desktop WebKit, and an iPhone WebKit profile: navigation, public routes, the walkthrough, scroll poses, pause/resume, reduced-motion changes, idle DOM updates, frame-rate-independent choreography, the device stage's fit and the 3D-or-CSS choice, header layout at phone widths, responsive overflow, keyboard access, axe WCAG checks, minimum text size, the no-JavaScript fallback, and the entrance. On a Mac, Playwright's WebKit has a real GPU and renders the 3D devices; headless Chromium only has software WebGL (SwiftShader) and exercises the CSS fallback, so both paths are covered. The suite takes about 1.5 minutes and runs locally only; CI just builds. Playwright WebKit is not real Safari: check visual or Safari-specific changes in Safari itself (for example by enabling Develop → Allow Remote Automation and driving it with `safaridriver`). Test dependencies are development-only.

## Build and publishing

Run `npm ci` and `npm run build`. `dist/` contains only the public website and is mounted at `/unbound/`. Local previews serve the built `dist/` directory at http://127.0.0.1:8080/unbound/. CI only checks that the site builds; run the Playwright suite locally with `npm test` before pushing.

After pushing and verifying a source commit, update only `unbound-web.commit` in sibling `krois-site/releases.json` and push the publishing repo. Its GitHub Pages workflow builds the recorded release, usually within a minute; `https://krois.dk/unbound/release.json` shows the commit that is live. To roll back, record an earlier commit the same way. Browsers may keep a page for up to ten minutes (GitHub Pages caching); a hard reload shows the new release at once. The app repository stays at `/Users/mathiaskroismoller/Git/Unbound/`; this website owns its published assets and requires no app checkout to build.

The extracted history preserves the website changes; hashes changed during extraction. The original shared history and unpublished historical icon commit remain in `mathiaskrois/krois-site`.
