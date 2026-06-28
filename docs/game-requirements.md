# The Dragon World — Game Requirements (Version 1.0)

> **Game name:** "The Dragon World". (Project folder remains `dragon-castle-game`.)
>
> **Source of truth for what the game does** (behaviour, rules, content). Implementation/design
> decisions — tech stack, rendering, audio engine, PWA, build/dev tooling — live in
> [architecture.md](architecture.md). Keep both current.
>
> The repo is public (GitHub Pages), so **no family names, ages, or other personal details** go in
> any committed file.

## Overview

The Dragon World is a cheerful, family-friendly arcade platform game. It is designed primarily for
children but should remain enjoyable for players of all ages.

The player controls a hero standing on top of a castle. Friendly dragons fly across the sky while
occasionally breathing fire. The objective is to **jump and touch dragons to collect them as stars**
while avoiding the falling fireballs.

The game should feel fun, colorful, rewarding, and **never violent**. Dragons are friends that
become stars when collected — they are never attacked or harmed.

## Design goals & constraints

The game should be:

- Easy to learn; challenging without becoming frustrating.
- Responsive on desktop and mobile (keyboard **and** touch).
- Colorful, bright, and welcoming — **richer than plain emoji**, with visually distinct heroes.
- **Installable** (Progressive Web App) and **playable completely offline** after first load.
- **Lightweight** — no asset downloads at runtime.
- **No backend, no user accounts, no networking** — everything runs locally in the browser.

_(How these are realized — stack, offline caching, rendering — see [architecture.md](architecture.md).)_

## Characters

Players choose a character before starting:

- Prince · Princess · Knight · Wizard · Archer

All characters play identically — only appearance changes. Selection is remembered across sessions.
Adding future characters should require **configuration only**, not new code paths.

## Costumes

Each character can wear multiple costumes (cosmetic only). Costumes are **global/shared** — unlocking
one makes it available on **every** character — and are kept permanently once earned.

Starting costume: **Classic**.

Unlockable:

- **Royal** — Complete Adventure once.
- **Forest** — Reach 5,000 total lifetime points.
- **Winter** — Reach 10,000 total lifetime points.
- **Golden Hero** — Complete all 12 Adventure levels in a **single flawless run (no hit taken)**.
  (The original "without a Game Over" wording is redundant — a Game Over ends the run, so any
  completion already implies no Game Over — so it is a no-damage run: a genuinely harder feat than
  Royal.)
- **Rainbow** — Collect 1,000 dragons across all games.

These five are the **only** costumes in v1.0. The dragon-collection milestones (below) are **badges,
not costumes** (only Rainbow is tied to a dragon count, at 1,000).

## Game modes

### Adventure

- **12 levels.** Players always begin at Level 1; there is **no save/resume**.
- Between levels these continue: score, hearts, character, costume, difficulty.
- Every **third** completed level restores one heart, up to the starting maximum.
- Completing Level 12 shows the **Victory** screen.

### Endless

- Continues until the player loses every heart.
- Difficulty gradually increases every **30 seconds**.
- High scores are saved separately per difficulty.

## Difficulty levels

| | Easy (younger) | Medium | Brave (experienced) |
|---|---|---|---|
| Starting hearts | 5 | 4 | 3 |
| Max dragons | 2 | 3 | 5 |
| Max fireballs | 2 | 4 | 6 |
| Feel | slow, large hitboxes, higher jump, forgiving | balanced | fast dragons & fire, small hitboxes, challenging |

## Core gameplay

The hero stands on the castle and can **Move Left, Move Right, Jump**. The hero cannot fall off or
move beyond the castle edges, cannot double-jump, uses a **fixed jump height**, and may move while
airborne. Only one jump may be active at a time.

### Dragons

Friendly dragons continuously fly across the sky: alternate entering from left and right, fly
across, bob gently up and down, don't overlap excessively, and never exceed the difficulty's max.
They occasionally breathe fire. **Touching a dragon** immediately collects it (it becomes sparkles,
awards points, shows a floating score, and disappears). A single jump may collect multiple dragons.

### Fireballs

Each dragon breathes fire on an independent cooldown (Easy: one fireball; Medium: one or two;
Brave: two). Fireballs fall, accelerate slightly, drift a little horizontally, and disappear off the
bottom of the screen or on hitting the player.

## Collision rules

- **Dragon:** collect immediately, award score, collect sound + sparkles.
- **Fireball:** lose one heart, fireball disappears, **1.5 s invincibility** (player flashes; no
  further damage during it).
- **Both at once:** collect the dragon **and** lose a heart; invincibility begins immediately after.

## Difficulty scaling

**Adventure** — per level: dragon speed +~8%, fire frequency +~5%. The difficulty's max-dragons is a
**starting cap that ramps**: +1 around Level 5 and +1 around Level 9 (e.g. Easy 2→3→4, Medium
3→4→5, Brave 5→6→7).

**Endless** — every 30 s dragon speed, fire speed, and fire frequency increase; scaling stops after
~10 minutes. Max dragons is a flat cap (no level ramp).

## Scoring

- Dragon collected: **100**.
- Combo: another dragon within **2 seconds** adds **+25** each.
- Adventure completion bonus: **500**; plus **100 per remaining heart**.
- Separate high scores for: Adventure Easy/Medium/Brave and Endless Easy/Medium/Brave.

## Dragon collection

Lifetime dragons collected is tracked, with milestone **badges** at **25 / 100 / 250 / 500 / 1000**
shown on the Dragon Collection screen. These are badges, not costume unlocks (reaching 1,000 also
unlocks the Rainbow costume, per Costumes).

## Controls

- **Keyboard:** Move ← → or **A**/**D**; Jump **Space** or **↑**; Pause **P**; Mute **M**.
- **Touch:** large always-visible Left / Right / Jump buttons (multi-touch; movement buttons held,
  jump tapped); pause and mute buttons always visible. Mouse clicks activate the same controls.

## Audio

Cheerful, child-friendly sound:

- **Sound effects** for: button click, jump, dragon collected, combo, fire breathing, player hit,
  heart restored, level complete, new costume unlocked, victory, game over.
- **Background music** for main menu, gameplay, and victory — cheerful and unobtrusive; may become
  slightly more energetic as difficulty rises.
- A **mute** control silences **all** sound; the preference is remembered.

_(Audio is synthesized at runtime — see [architecture.md](architecture.md).)_

## User interface

- **Main menu:** Adventure, Endless, difficulty, character & costume selection, High Scores, Dragon
  Collection, How to Play. _(A separate Settings screen is not used — mute/pause cover it.)_
- **HUD:** hearts, score, current level + objective (Adventure), pause, mute.
- **Pause:** Resume, Restart, Main Menu.
- **Level Complete:** score, next-level goal, Continue.
- **Victory:** fireworks, final score, any newly unlocked costumes, Play Again, Main Menu.
- **Game Over:** final score, best score, dragons collected, Play Again, Main Menu.

## Animations

Hero squash before jumping; dragons bob; fireballs leave a small ember trail; sparkles on collect;
floating score numbers; hearts bounce when lost/restored; Victory fireworks; gentle screen shake on
a hit (**disabled on Easy**).

## Performance & display

- Target **60 FPS**; remain playable at 30 FPS.
- Maintain aspect ratio, scale responsively, support high-DPI displays.
- **Landscape preferred**; portrait shows a friendly "rotate your device" hint.

## Accessibility

Large touch controls; high-contrast UI; icons paired with text where practical; no flashing above
three flashes/second; pause available at all times; mute remembered.

## Saving

Remembered across sessions: selected character, costume, unlocked costumes, high scores, lifetime
dragons, lifetime points, mute preference, selected difficulty, selected mode. In-progress games are
**not** saved; Adventure always starts at Level 1. _(Storage mechanism — see
[architecture.md](architecture.md).)_

## Browser support

Desktop: Chrome, Edge, Firefox, Safari. Mobile: Chrome, Samsung Internet, Safari. Modern browsers
only.

## Future enhancements

Additional characters/costumes, boss dragons, power-ups (shield, double jump, slow motion),
achievements, statistics screen, seasonal themes, daily challenges, cloud saves, multiplayer.

## Non-goals (Version 1.0)

Online multiplayer, accounts, networking, cloud saves, advertising, analytics, microtransactions,
in-app purchases, game engines, build pipelines, server-side code, and any **runtime/CDN asset
loading** (assets, if added, must be vendored — see [architecture.md](architecture.md)).
