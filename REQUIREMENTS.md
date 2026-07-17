# Chain Reaction — Game Requirements & Design Document

## 1. Overview

**Chain Reaction** is a turn-based strategy game played on a grid. Players place
charged orbs into cells; when a cell overflows its capacity it detonates,
firing orbs into neighboring cells and converting any opponent orbs there to
the current player's color. The goal is to be the last color standing on the
board.

This document is the single source of truth for what is being built: rules,
feature scope, technical approach, and UI/visual direction. The build target
is a **single self-contained `index.html` file** using vanilla **HTML, CSS,
and JavaScript** — no frameworks, no build step, no backend. Anyone should be
able to double-click the file and play.

---

## 2. Objective

Take over the entire board by eliminating every opponent color. A player wins
when they are the only color remaining among all occupied cells.

---

## 3. Core Gameplay Rules

1. Players take turns placing one orb of their color into any cell that is
   either **empty** or **already owned by them**. Placing into an
   opponent-owned cell is not allowed.
2. Every cell has a **capacity**, equal to the number of orthogonally
   adjacent cells it has:
   - Corner cell → capacity **2**
   - Edge cell → capacity **3**
   - Interior cell → capacity **4**
3. When a cell's orb count **reaches** its capacity, it **explodes**:
   - The cell's orb count is reduced by its capacity (normally to 0).
   - One orb is sent to each orthogonally adjacent cell.
   - Every cell that receives an orb this way is captured — it becomes the
     current player's color, regardless of who owned it before.
4. If an adjacent cell reaches its own capacity because of this overflow, it
   explodes too, on the next resolution step. This can cascade into a **chain
   reaction** that sweeps across the board.
5. Explosions resolve in discrete waves (all currently-overflowing cells pop
   together, then the board is re-checked) so the chain is visible and
   readable rather than instantaneous.
6. After each wave, the game checks the win condition (see below). If it is
   met, the chain stops immediately and the game ends — it does not need to
   fully "settle."
7. **Turn order & elimination:** every player must get at least one placement
   before elimination is evaluated. After that, a player who owns zero orbs
   on the board is eliminated and is skipped for the rest of the game.
8. Play continues until only one color remains on the board.

---

## 4. Winning the Game

The game ends the instant only one player's color remains among all occupied
cells on the board (checked only after all players have placed at least once,
so the game cannot end on turn 1). A **Game Over** screen announces the
winner and offers a rematch.

---

## 5. Strategy Tips (shown in an in-game "How to Play" panel)

- Corners and edges explode with fewer orbs (capacity 2–3), making them fast,
  cheap threats — but they're also easy for an opponent to snipe early.
- Interior cells hold more orbs (capacity 4) and can trigger the biggest
  chain reactions — build them up carefully.
- Don't place your last safe orb next to a strong opponent cluster; a single
  opponent move can trigger a chain that flips a large section of the board.
- Watch cells that are one orb away from exploding (capacity − 1) — these are
  live threats on the very next turn.

---

## 6. Feature Scope

### 6.1 Must-have (v1)
- [x] 2–4 player support, selectable before/at the start of a game.
- [x] Fixed 6 × 9 grid (54 cells) — portrait-friendly, classic Chain Reaction
      proportions.
- [x] Click/tap to place an orb; full input validation (no placing on
      opponent cells, no input during an animating chain reaction).
- [x] Capacity-based explosion + chain-reaction resolution engine, wave by
      wave, with a short animation delay between waves.
- [x] Turn indicator showing whose turn it is.
- [x] Live per-player orb count.
- [x] Elimination tracking and automatic turn skipping.
- [x] Win detection + Game Over overlay with winner announcement.
- [x] "New Game" / rematch control that preserves the chosen player count.
- [x] "How to Play" panel summarizing rules + strategy tips.
- [x] Fully responsive layout: usable on a phone screen and a desktop window.
- [x] Modern visual design (see §7) — no default browser styling.

### 6.2 Nice-to-have / explicitly out of scope for v1
- AI / computer opponent.
- Online or pass-and-play-over-network multiplayer.
- Undo / move history / replay.
- Sound effects and music.
- Persistent stats or leaderboards.
- Adjustable grid size / custom board shapes.

These are listed so they're not accidentally half-built — they can be picked
up later as clean follow-ups.

---

## 7. Visual & UX Direction

**Concept:** the board *is* a reactor core. Orbs are charged particles;
explosions are literal energy releases. The visual language should make the
central mechanic — capacity, overflow, chain reaction — legible at a glance,
not just decorative.

### 7.1 Design tokens

**Color**
| Token | Hex | Use |
|---|---|---|
| `--bg-void` | `#0a0d13` | App background |
| `--bg-panel` | `rgba(255,255,255,0.045)` | Glass panel fill |
| `--border-glass` | `rgba(255,255,255,0.09)` | Panel/cell borders |
| `--text-primary` | `#eef1f7` | Primary text |
| `--text-muted` | `#828a9a` | Secondary text |
| `--p1-ember` | `#ff5a5f` | Player 1 |
| `--p2-ion` | `#2fe0ff` | Player 2 |
| `--p3-volt` | `#ffd23f` | Player 3 |
| `--p4-plasma` | `#b168ff` | Player 4 |

**Type**
- Display / headings / numbers: **Space Grotesk** — geometric, technical,
  fits the "energy/physics" theme.
- Body / UI labels: **Inter** — neutral, highly legible at small sizes.

**Layout**
- Single-viewport app shell: top bar (title + player-count control), the
  board as the visual hero in the center, a turn/status rail alongside
  (below the board on narrow screens, beside it on wide screens).
- Glassmorphic panels (translucent fill, soft blur, hairline border) float
  over the void background rather than using hard card borders.

**Signature moment**
- The chain reaction itself is the one place motion is spent generously: an
  exploding cell fires a brief expanding shockwave ring in the acting
  player's color, and captured cells flash as they change ownership. Outside
  of this, animation stays restrained (subtle hover/press states only).

### 7.2 Accessibility & robustness
- Color is never the *only* signal — the current player is also named in
  text, and cells show orb count clearly.
- Visible focus states for keyboard interaction.
- `prefers-reduced-motion` is respected (shockwave/pulse animations shorten
  or disable).
- Layout tested down to a 360px-wide mobile viewport.

---

## 8. Technical Requirements

- **Stack:** plain HTML5 + CSS3 + vanilla JavaScript (ES6+). No frameworks,
  no bundler, no external JS dependencies. Google Fonts is the only external
  network dependency (with a system-font fallback stack).
- **Deliverable:** one self-contained `index.html` (CSS in `<style>`, JS in
  `<script>`) so it can be opened directly from disk or dropped onto any
  static host (e.g. Cloudflare Pages) with zero configuration.
- **State:** kept entirely in memory (in JS variables); no `localStorage`,
  no backend, no network calls other than the font stylesheet.
- **Rendering:** the board is a CSS Grid of cell elements; orbs inside a cell
  are laid out with a small inner grid so 1–4 orbs arrange in readable
  patterns (center / diagonal / triangle / four-corners).
- **Explosion engine:** iterative, wave-based (not recursive), so it can't
  blow the call stack on a large cascading chain; re-scans the board once per
  wave, applies all simultaneous explosions, renders, checks the win
  condition, then continues if needed.
- **Browser support:** current versions of Chrome, Firefox, Safari, Edge
  (desktop and mobile). Relies on CSS Grid, `backdrop-filter` (graceful
  degradation if unsupported), and standard ES6+ JS.

---

## 9. File Structure

```
chain-reaction/
└── index.html   # everything: markup, styles, and game logic
```

A single file is a deliberate choice for this project (see §8) — it keeps
the game trivially shareable and deployable.

---

## 10. Acceptance Checklist

- [ ] Can start a new game with 2, 3, or 4 players.
- [ ] Cannot place an orb on a cell owned by another player.
- [ ] A cell explodes exactly at capacity, not before/after.
- [ ] Explosions cascade correctly and visibly, wave by wave.
- [ ] Captured cells correctly change color/ownership.
- [ ] A player with zero orbs (after their first move) is skipped on future
      turns.
- [ ] Game correctly declares a winner the moment one color remains.
- [ ] "New Game" fully resets board, turn order, and player states.
- [ ] Layout holds up on a narrow mobile viewport and a wide desktop window.
- [ ] No console errors during a full playthrough.
