# The Dragon World — Architecture & Implementation Notes

> The **"how"** — implementation and design decisions. The **"what"** (game behaviour, rules,
> content) lives in [game-requirements.md](game-requirements.md). Keep both current. Separated by
> stability: requirements change rarely; the notes here churn with the code.

## Technology stack

Use only: **HTML5, CSS3, vanilla JavaScript (ES2022), HTML5 Canvas, SVG, Web Audio API,
localStorage.**

Do **NOT** use: React, Vue, Angular, Phaser, Pixi, jQuery, Node.js, build tools, bundlers,
TypeScript, or any external **libraries / game engines**.

**No build step** — the game runs by opening `index.html` directly, and is deployed as a plain
static site.

## External-assets policy

External art/audio may be **sourced from outside but must be vendored**: saved as a **local copy**
in the repo, **license-clean** (original or CC0/permissive), and cached by the service worker.
**Nothing is fetched at runtime**, so the game stays **fully offline**. (In v1.0 all art is original
vector drawn on the Canvas plus one hand-authored SVG app icon; audio is synthesized — so there are
no third-party assets to vendor yet.)

## Project structure

```
dragon-castle-game/
  index.html              # entry point + all screens/overlays
  style.css               # menus / UI chrome (game art is on the canvas)
  game.js                 # all game logic + vector rendering (single file)
  manifest.webmanifest    # PWA metadata
  service-worker.js       # offline cache (versioned)
  icons/                  # icon.svg (source) + generated icon-192.png / icon-512.png
  assets/                 # (optional) vendored license-clean art/audio, if ever added
  docs/
    game-requirements.md  # the spec (what)
    architecture.md       # this file (how)
  README.md
```

## Rendering

- Fixed **logical canvas of 1280 × 720**; everything is drawn in logical coordinates.
- The `<canvas>` fills a CSS `aspect-ratio: 16/9` stage (letterboxed in the viewport). Each frame
  the context is set with `setTransform(scaleX, 0, 0, scaleY, …)` to map logical → backing-store
  pixels, **DPR-aware** (capped at 2.5×) for crisp output. Recomputed on resize/orientation change.
- Actors (hero, dragons, castle, fire, hearts, stars, clouds) are **drawn procedurally** with
  Canvas paths/gradients — no sprite sheets, no image loads.
- **Character + costume art is data-driven:** `CHARACTERS` and `COSTUMES` tables → `resolveLook()`
  → `drawHero()` which assembles parts (hat/cape/shield/staff/bow/dress/hair/beard). A costume is a
  **palette recolor** (`recolor`, or `'rainbow'` for hue-cycling) plus an optional animated **aura**
  (gold glow / snow / rainbow rings). Adding a hero or costume = a table entry.
- Main loop is `requestAnimationFrame` with a clamped delta (≤ 0.05 s). Particle count is capped
  (`MAX_PARTICLES`) to respect the performance budget.

## Audio

- **Procedural Web Audio** — `AudioContext` created lazily on the first user gesture (autoplay
  policy). SFX are short oscillator+gain envelopes; background music is a lightweight
  `setInterval` note sequencer with three loops (`menu` / `gameplay` / `victory`).
- **Mute** gates all output (`game.muted`) and persists. No audio files are bundled.

## Persistence (localStorage keys)

| Key | Meaning |
|---|---|
| `dw_character`, `dw_costume` | current selection |
| `dw_muted` | mute preference (`'1'`/`'0'`) |
| `dw_points`, `dw_dragons` | lifetime points / dragons collected |
| `dw_adv`, `dw_gold` | Adventure-finished / flawless-run flags (drive Royal/Golden) |
| `dw_highscores` | JSON map of `"<mode>_<difficulty>"` → best score |
| `dw_unlocked` | JSON array of owned costume keys |

In-progress games are **not** saved; Adventure always starts at Level 1. Unlocks are derived from
stats/flags by `evaluateUnlocks()` on load and at the end of each run.

## PWA / offline

- `manifest.webmanifest`: fullscreen, landscape, SVG + PNG icons (maskable).
- `service-worker.js`: **cache-first**, falling back to network, with a **versioned cache**
  (`dragon-world-v1`). Uses `skipWaiting()` + `clients.claim()`; old caches are deleted on
  activate. **Bump the `CACHE` constant** to roll out updated files to installed clients.

## Code organization (`game.js`)

Single file, sectioned in this order: **CONFIG · STATE · SAVE/UNLOCKS · AUDIO · INPUT · ART
HELPERS · HERO ART · DRAGON/FIRE ART · ENTITIES · MODES/UPDATE · RENDER · HUD · LOOP · MENU/UI.**
Tunable gameplay constants live together in `CONFIG`/`DIFFICULTY` so balancing is one place.

## Build / dev tooling

There is **no build pipeline**. Useful commands during development:

- **Run locally over http** (needed for the service worker / PWA; `file://` plays but won't install):
  ```sh
  python3 -m http.server 8123        # then open http://localhost:8123/
  ```
- **Regenerate the PNG app icons from `icons/icon.svg`.** The dev machine had no `rsvg-convert` /
  ImageMagick, so PNGs are rendered with macOS Quick Look + `sips`:
  ```sh
  qlmanage -t -s 512 -o icons icons/icon.svg     # → icons/icon.svg.png
  mv -f icons/icon.svg.png icons/icon-512.png
  sips -z 192 192 icons/icon-512.png --out icons/icon-192.png
  ```
  Re-run after editing `icon.svg`. (On a machine with `rsvg-convert`/`magick`, prefer those for
  sharper output.)
- **Hosting / deploy:** GitHub Pages from `main` / root. Update flow: push to `main`, then **bump
  `CACHE`** in `service-worker.js` (e.g. `dragon-world-v2`) so installed phones pick up new files.

## Implementation status (v1.0) — deltas from the spec

The game is **fully implemented and live** (GitHub Pages, installable PWA). Known deltas, recorded
so doc and code stay in sync:

- **No separate Settings screen** — settings are covered by the always-visible **mute** and
  **pause** buttons (mute persists). The Main-Menu "Settings" entry was folded into these.
- **Background music** is simple procedural loops; it does **not** yet get more energetic with
  difficulty.
- **Accessibility:** most controls pair an icon with text; the **mute/pause** buttons are
  icon-only (a small future polish item).
- **Golden Hero** unlock = flawless (no-hit) Adventure completion (see Costumes in the spec).
