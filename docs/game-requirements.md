# The Dragon World — Complete Game Requirements (Version 1.0)

> **Game name:** "The Dragon World". (Project folder remains `dragon-castle-game`.)

> **Source of truth for the game's design.** Keep this current. The repo may be made public
> (GitHub Pages), so **no family names, ages, or other personal details** go in any committed file.

## Overview

The Dragon World is a cheerful, family-friendly arcade platform game built using plain HTML, CSS, and
JavaScript. The game is designed primarily for children but should remain enjoyable for players of
all ages.

The player controls a hero standing on top of a castle. Friendly dragons fly across the sky while
occasionally breathing fire. The objective is to **jump and touch dragons to collect them as stars**
while avoiding the falling fireballs.

The game should feel fun, colorful, rewarding, and **never violent**. Dragons are friends that
become stars when collected — they are never attacked or harmed.

The game must run **completely offline** after installation, require **no backend**, **no user
accounts**, and **no external libraries**.

## Design Goals

The game should be:

- Easy to learn
- Challenging without becoming frustrating
- Responsive on desktop and mobile
- Beautiful using only emoji and Canvas graphics
- Installable as a Progressive Web App
- Playable completely offline
- Lightweight with no asset downloads
- Suitable for publishing on GitHub Pages

## Technology

Use only:

- HTML5
- CSS3
- Vanilla JavaScript (ES2022)
- HTML5 Canvas
- SVG (inline and/or local asset files)
- Web Audio API
- localStorage

Do **NOT** use: React, Vue, Angular, Phaser, Pixi, jQuery, Node.js, build tools, bundlers,
TypeScript, or any external **libraries / game engines**.

**External assets** (art/audio) may be **sourced from outside but must be vendored** — saved as a
local copy in the repo, license-clean, and cached. **Nothing is fetched at runtime,** so the game
**works fully offline** and by simply opening `index.html` locally.

## Project Structure

```
dragon-castle-game/
  index.html
  style.css
  game.js
  manifest.webmanifest
  service-worker.js
  icons/
  assets/            # vendored, license-clean SVG art (and any audio); cached for offline
  docs/
    game-requirements.md
  README.md
```

## Art Style

The game uses **richer-than-emoji vector art**: **original, hand-authored SVG** for the heroes
(Prince, Princess, Knight, Wizard, Archer), dragons, castle, fire, hearts, stars, and sparkles —
committed into the repo and rendered on the Canvas (drawn directly and/or composited from SVG).
Plain Canvas drawing (shapes, gradients) is also used for backgrounds and effects.

- **Assets may be sourced externally but must be vendored** — saved as a **local copy** in the repo,
  **license-clean** (original or CC0/permissive). **Nothing is fetched at runtime;** the game bundles
  everything and **stays fully offline.**
- **No external JS libraries or game engines** — rendering is hand-written (vanilla JS + Canvas/SVG).
- **No external fonts** (system fonts or drawn text only).
- Art is **data-driven** so a character/costume is described by a small palette + parts definition
  (and/or a set of SVGs), making new characters and outfits easy to add.

The overall appearance should be colorful, bright, and welcoming.

## Characters

Players choose a character before starting. Characters:

- Prince
- Princess
- Knight
- Wizard
- Archer

All characters play identically — only appearance changes. Selection is remembered using
localStorage. The character system should be **data-driven** so adding future characters requires
only configuration changes.

## Costumes

Each character supports multiple costumes.

Starting costume:

- **Classic**

Unlockable costumes:

- **Royal** — Complete Adventure once
- **Forest** — Reach 5,000 total lifetime points
- **Winter** — Reach 10,000 total lifetime points
- **Golden Hero** — Complete all 12 Adventure levels without a Game Over
- **Rainbow** — Collect 1,000 dragons across all games

Costumes are cosmetic only. Each costume is a **drawn outfit variant** (palette swap plus small
parts like a crown, cape, or aura), defined in data so new costumes are easy to add.

**Scope — costumes are global/shared:** unlocking a costume makes it available on **every**
character (not unlocked per character). Unlocked costumes are permanently stored using localStorage.

These five are the **only** costumes in v1.0 — the dragon-collection milestones below are **badges,
not costumes** (only the **Rainbow** costume is tied to a dragon count, at 1,000).

## Game Modes

### Adventure

- Adventure contains **12 levels**.
- Players always begin at Level 1. There is **no save/resume system**.
- Between levels the following continue: score, hearts, selected character, selected costume,
  difficulty.
- Every third completed level restores one heart, up to the player's starting maximum.
- Completing Level 12 displays the **Victory** screen.

### Endless

- The game continues until the player loses every heart.
- Difficulty gradually increases every **30 seconds**.
- High scores are saved separately for each difficulty.

## Difficulty Levels

### Easy (recommended for younger children)

- Starting Hearts: **5**
- Maximum Dragons: **2**
- Maximum Fireballs: **2**
- Slow dragons, slow fireballs, large collision boxes, higher jump, slow difficulty increase.
- Designed to be forgiving.

### Medium (recommended for children with some gaming experience)

- Starting Hearts: **4**
- Maximum Dragons: **3**
- Maximum Fireballs: **4**
- Balanced gameplay.

### Brave (recommended for experienced players)

- Starting Hearts: **3**
- Maximum Dragons: **5**
- Maximum Fireballs: **6**
- Fast dragons, frequent fire, fast falling fireballs, smaller collision boxes, fast difficulty
  increase.
- Still fair but significantly more challenging.

## Core Gameplay

The hero stands on top of the castle. The player may Move Left, Move Right, and Jump.

The hero:

- Cannot fall from the castle
- Cannot move beyond castle edges
- Cannot double jump
- Can move while airborne
- Uses a fixed jump height

Only one jump may be active at a time.

### Dragons

Friendly dragons continuously fly across the sky. Behavior:

- Alternate entering from left and right.
- Fly across the screen.
- Gentle vertical bobbing movement.
- Never overlap excessively.
- Never exceed the maximum dragons allowed for the selected difficulty.
- Dragons occasionally breathe fire.

Touching a dragon:

- Immediately collects it.
- Dragon becomes sparkles.
- Player gains points.
- Floating score animation appears.
- Dragon disappears.

A single jump may collect multiple dragons.

### Fireballs

Each dragon has an independent cooldown timer. When ready, it breathes fire.

- Easy: one fireball
- Medium: one or two fireballs
- Brave: two fireballs

Fireballs:

- Fall downward
- Accelerate slightly
- Randomly drift a little horizontally
- Disappear after leaving the screen
- Disappear immediately after hitting the player

## Collision Rules

Dragon collision:

- Collect dragon immediately
- Award score
- Play collect sound
- Show sparkle animation

Fireball collision:

- Lose one heart
- Fireball disappears
- Player becomes invincible for **1.5 seconds**
- Player flashes while invincible
- No additional damage during invincibility

If a dragon and fireball are touched simultaneously:

- Collect the dragon
- Award points
- Player still loses one heart
- Invincibility begins immediately afterward

## Difficulty Scaling

### Adventure

- Every level: dragon speed increases by approximately **8%**.
- Every level: fire frequency increases by approximately **5%**.
- The difficulty's **Maximum Dragons is a starting cap that ramps up** in Adventure: it increases by
  one around **Level 5** and again around **Level 9** (e.g. Easy 2 → 3 → 4; Medium 3 → 4 → 5;
  Brave 5 → 6 → 7). (In **Endless**, the difficulty's Maximum Dragons is a **flat cap** — no
  level-based ramp.)

### Endless

- Every 30 seconds: dragon speed increases, fire speed increases, fire frequency increases.
- Difficulty stops increasing after approximately **ten minutes**.

## Scoring

- Dragon collected: **100 points**
- Combo: collect another dragon within **two seconds**; each additional dragon awards **+25 bonus**.
- Adventure completion bonus: **500 points**
- Remaining hearts after completing Adventure: **100 points each**

Separate high scores are stored for: Adventure Easy, Adventure Medium, Adventure Brave, Endless
Easy, Endless Medium, Endless Brave.

## Dragon Collection

The game tracks lifetime dragons collected. Milestones:

- 25 dragons
- 100 dragons
- 250 dragons
- 500 dragons
- 1000 dragons

These milestones are **collection badges** shown on the Dragon Collection screen — they are **not**
costume unlocks (with the single exception that reaching **1,000** also unlocks the **Rainbow**
costume, as listed under Costumes). Lifetime totals are stored using localStorage.

## Controls

### Keyboard

- Move Left: Left Arrow or A
- Move Right: Right Arrow or D
- Jump: Space or Up Arrow
- Pause: P
- Mute: M

### Touch

Large on-screen controls: Left, Right, Jump.

- Buttons remain visible.
- Buttons support multi-touch.
- Movement buttons may be held.
- Jump is activated by tapping.
- Pause and mute buttons remain visible.

Mouse clicks should activate the same controls.

## Audio

Use Web Audio API. Sound is **synthesized procedurally** at runtime by default (oscillators/noise,
simple chiptune-style melody loops) — this needs nothing to source and keeps the game offline. If
any pre-made audio is used instead of synthesis, it must be a **vendored local file** (committed,
license-clean, cached); **nothing is fetched at runtime.**

Sound effects:

- Button click, Jump, Dragon collected, Combo, Fire breathing, Player hit, Heart restored, Level
  complete, New costume unlocked, Victory, Game Over.

Background music: Main Menu, Gameplay, Victory.

- Music should be cheerful and unobtrusive.
- Mute must silence all sounds.
- Mute preference is remembered.
- As difficulty increases, music may become slightly more energetic.

## User Interface

### Main Menu

Adventure, Endless, Difficulty selection, Character selection, Costume selection, High scores,
Dragon Collection, How to Play, Settings.

### HUD

Hearts, Score, Current level, Adventure objective, Pause, Mute.

### Pause Menu

Resume, Restart, Main Menu.

### Level Complete

Score, Remaining hearts, Continue.

### Victory Screen

Fireworks, Sparkles, Victory fanfare, display newly unlocked costumes (if any), Final score,
Play Again, Main Menu.

### Game Over (Endless)

Final score, High score, Play Again, Main Menu.

## Animations

- Hero squashes slightly before jumping.
- Dragons gently bob while flying.
- Fireballs leave a small ember trail.
- Collecting dragons creates sparkles.
- Floating score numbers appear.
- Hearts bounce when lost.
- Level Complete banner slides in.
- Victory screen shows fireworks.
- Very gentle screen shake occurs when hit.
- Screen shake is disabled on Easy difficulty.

## Performance

- Target 60 FPS; remain playable at 30 FPS.
- Maximum active objects: 100.
- Canvas logical resolution: 1280 × 720.
- Maintain aspect ratio; scale responsively; support high-DPI displays.
- Landscape is preferred. Portrait displays a friendly "Rotate your device" message while remaining
  usable.

## Accessibility

- Large touch controls.
- High-contrast UI.
- Icons always accompanied by text.
- No flashing effects above three flashes per second.
- Pause available at all times.
- Mute remembered.

## Saving

Persist using localStorage:

- Selected character, selected costume, unlocked costumes, high scores, lifetime dragons collected,
  lifetime points, mute preference, selected difficulty, selected game mode.

Do not save in-progress games. Adventure always starts from Level 1.

## Progressive Web App

Include `manifest.webmanifest` and `service-worker.js`. App **icons** (in `icons/`) are **generated
locally and committed** (drawn as SVG, plus the PNG sizes a manifest needs) — not downloaded from
anywhere.

- Installable
- Offline after first load
- Fullscreen support
- Works on Android and iOS
- Automatic cache updates; new version activated after refresh or reopening.

## Browser Support

- Desktop: Chrome, Edge, Firefox, Safari.
- Mobile: Chrome, Samsung Internet, Safari.
- Modern browsers only.

## Coding Standards

- Use readable ES2022 JavaScript.
- Keep all gameplay constants together in one configuration section.
- Separate rendering, physics, input, audio, UI, and game state into clearly organized sections
  within `game.js`.
- Comment non-obvious logic.
- Write code that is easy to extend with additional characters, costumes, levels, and power-ups.

## Future Enhancements

Additional characters, additional costumes, boss dragons, power-ups (shield, double jump, slow
motion), achievements, statistics screen, seasonal themes, daily challenges, cloud saves,
multiplayer.

## Non-Goals (Version 1.0)

Online multiplayer, accounts, networking, cloud saves, advertising, analytics, microtransactions,
in-app purchases, external assets, game engines, build pipelines, server-side code.

---

The objective is to create a polished, fun, lightweight, offline-friendly game that children can
enjoy immediately on both desktop and mobile while remaining simple to maintain and extend.
