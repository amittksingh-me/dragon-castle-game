# 🐉 The Dragon World

A cheerful, family-friendly arcade game. A hero stands on a castle; friendly dragons fly across the
sky and breathe fire. **Jump to touch the dragons** and collect them as stars — while dodging the
falling fire!

Built with plain **HTML + CSS + vanilla JavaScript + Canvas** — no frameworks, no build step, no
servers, **fully offline**. Installable as a Progressive Web App.

See [`docs/game-requirements.md`](docs/game-requirements.md) for the full design spec.

## How to play

- **Move:** ◀ ▶ arrow keys (or **A** / **D**), or the on-screen buttons.
- **Jump:** **Space** or **↑** (or the **JUMP** button) to touch a dragon → it becomes a star.
- **Dodge** the falling 🔥 — a hit costs a ❤️.
- **Combo:** catch dragons quickly in a row for bonus points.
- **Pause:** **P** · **Mute:** **M**

**Modes:** 🗺️ **Adventure** (clear 12 levels) and ♾️ **Endless** (survive as long as you can).
**Difficulties:** Easy / Medium / Brave. **Heroes:** Knight, Prince, Princess, Wizard, Archer —
each with **unlockable costumes** earned by collecting dragons and scoring points.

## Run it locally

It's a static site, so any of these work:

- **Easiest:** double-click `index.html` to open it in your browser.
  *(Note: the service worker / offline install only activates when served over `http(s)`, not
  `file://` — the game itself plays fine either way.)*
- **With a local server** (enables PWA/offline locally):
  ```sh
  cd dragon-castle-game
  python3 -m http.server 8123
  # then open http://localhost:8123/
  ```

## Put it on your phone (GitHub Pages)

1. Create a GitHub repo and push this folder:
   ```sh
   git remote add origin https://github.com/<you>/dragon-castle-game.git
   git push -u origin main
   ```
2. On GitHub: **Settings → Pages → Build and deployment → Source: "Deploy from a branch"**, pick
   **`main`** and **`/ (root)`**, then **Save**.
3. After a minute, your game is live at
   `https://<you>.github.io/dragon-castle-game/`.
4. Open that URL on your phone → browser menu → **Add to Home Screen**. It installs as a
   fullscreen, **offline-capable** app with its own icon.

> Updating later: push changes, then bump the `CACHE` version in
> [`service-worker.js`](service-worker.js) (e.g. `dragon-world-v2`) so phones pick up the new files.

## Project layout

```
index.html            # entry point + screens
style.css             # menus / UI (the game art is drawn on the canvas)
game.js               # all game logic + vector rendering
manifest.webmanifest  # PWA metadata
service-worker.js     # offline caching
icons/                # app icons (original SVG + generated PNGs)
docs/                 # game-requirements.md (the spec)
```

## Privacy

Everything runs locally in the browser. No accounts, no network calls, no analytics, no ads.
Progress (high scores, costumes, settings) is saved only in your browser's `localStorage`.
