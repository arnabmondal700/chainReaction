# Chain Reaction — Development Rules & Conventions

> This document records the coding conventions, architectural decisions, and
> design patterns used in this project. It serves as a living reference for
> contributors.

---

## 1. Project Overview

Chain Reaction is a turn-based strategy game played on a grid. Players place
charged orbs into cells; when a cell overflows its capacity it detonates,
firing orbs into neighboring cells and converting any opponent orbs there to
the current player's color. The goal is to be the last color standing on the
board.

---

## 2. Stack & Tooling

- **Stack:** plain HTML5 + CSS3 + vanilla JavaScript (ES6+ modules)
- **Frameworks:** none — zero runtime dependencies
- **External deps:** Google Fonts only (Space Grotesk + Inter)
- **Build:** custom `build.js` (Node.js) that concatenates into a single
  deployable `dist/index.html`
- **Browser target:** current Chrome, Firefox, Safari, Edge (desktop + mobile)

---

## 3. File & Module Organization

```
chain-reaction/
├── index.html          # Entry point (minimal HTML shell + module script tags)
├── RULES.md            # This file
├── MEMORY.md           # Architecture memory map
├── REQUIREMENTS.md     # Product requirements (source of truth for features)
├── css/
│   └── styles.css      # All styles, organized by component in sections
├── js/
│   ├── constants.js    # Game constants (grid dimensions, player defs, timings)
│   ├── state.js        # Game state management (board, players, turn)
│   ├── rules.js        # Pure game logic — zero DOM references
│   ├── render.js       # DOM rendering (board, cells, orbs, panels, overlays)
│   ├── ui.js           # Interaction handlers (clicks, keyboard, overlays)
│   └── main.js         # Entry point — bootstraps and wires everything together
├── build.js            # Node.js build script (concatenates into dist/)
└── dist/               # Build output (single self-contained index.html)
```

### 3.1 Module Dependency Order

```
constants → state → rules → render → ui → main
```

Each module only imports from earlier modules in this chain. This ensures
the build concatenation works without circular dependencies.

### 3.2 Module Responsibilities

| Module | Responsibilities | Imports From |
|---|---|---|
| `constants.js` | Grid dimensions, player definitions, animation timings, CSS class names | _(none)_ |
| `state.js` | Board state, player tracking, turn index, busy flag, reset functions | `constants.js` |
| `rules.js` | `getCapacity()`, `getNeighbors()`, `explodeCell()`, win detection, elimination checks | `constants.js`, `state.js` |
| `render.js` | DOM element creation, cell/orb rendering, player panel, turn indicator | `constants.js`, `state.js`, `rules.js` |
| `ui.js` | Click handlers, keyboard support, overlay management, chain reaction loop | `constants.js`, `state.js`, `rules.js`, `render.js` |
| `main.js` | Bootstraps game, wires all event listeners, starts first game | All modules |

---

## 4. Coding Conventions

### 4.1 Naming

| Construct | Convention | Example |
|---|---|---|
| Variables | camelCase | `currentPlayerIndex` |
| Functions | camelCase | `getCapacity()`, `handleCellClick()` |
| Constants | UPPER_SNAKE_CASE | `ROWS`, `COLS`, `PLAYER_DEFS` |
| CSS custom properties | `--kebab-case` | `--bg-void`, `--p1-ember` |
| CSS classes | kebab-case | `.player-chip`, `.turn-dot` |
| HTML data attributes | kebab-case | `data-players`, `data-row` |
| File names | kebab-case | `styles.css`, `constants.js` |

### 4.2 Formatting

- 2-space indentation for all code (HTML, CSS, JS)
- Semicolons required in JS
- Single quotes for JS strings (double quotes for HTML attributes)
- Trailing commas in multi-line arrays/objects
- Max line length: 100 characters (soft limit)
- One blank line between function definitions

### 4.3 JS Style

- Run in strict mode (`'use strict'`)
- Use `const` by default, `let` only when reassignment is needed (no `var`)
- Arrow functions for callbacks and short functions
- Named function declarations for module-level functions (better stack traces)
- `===` always (no loose equality)
- Early returns preferred over nested `if` blocks

### 4.4 CSS Style

- Design tokens in `:root` as custom properties
- Component-based section dividers with comments
- Mobile-first responsive approach with `min-width` breakpoints
- Use logical properties (`inset` over `top/right/bottom/left`)
- `prefers-reduced-motion` respected globally

---

## 5. Architecture Decisions

### ADR-001: Wave-Based Explosion Engine

**Decision:** Use an iterative, wave-based loop rather than recursive explosion
resolution.

**Rationale:** Recursive depth could exceed the call stack on a large
cascading chain (~54 cells worst case). An iterative approach:
1. Scans the board for all cells at capacity
2. Explodes them simultaneously (applies all changes)
3. Renders the new state
4. Re-scans and repeats until no cells are at capacity

This is O(n) per wave and cannot blow the stack.

### ADR-002: State-in-Memory, Not DOM

**Decision:** All game state is kept in JavaScript variables (not stored in
DOM data attributes or rendered HTML). The DOM is purely a view of the state.

**Rationale:** Single source of truth prevents sync bugs. The render function
always reads from state and writes to DOM — never the reverse.

### ADR-003: Modules with Zero DOM References in `rules.js`

**Decision:** The `rules.js` module must not import or reference any DOM
elements.

**Rationale:** Game logic should be testable without a browser. `rules.js`
can be unit-tested in Node.js. It receives state data as arguments and returns
results.

### ADR-004: Single-File Build Target

**Decision:** Development uses separate files; deployment concatenates into
one self-contained `index.html`.

**Rationale:** Development is easier with separate files (clearer diffs,
smaller scopes, easier debugging). The single-file deliverable meets the
original product requirement of being trivially deployable and shareable
(double-click to play, drop on any static host).

### ADR-005: IIFE for Single-File Build, ES6 Modules for Development

**Decision:** Development uses ES6 `import`/`export`. The build script
concatenates source in dependency order and wraps in an IIFE.

**Rationale:** ES6 modules provide clear dependency tracking. The build
output wraps in an IIFE to avoid polluting the global scope — same scope
isolation the modules provided.

---

## 6. Animation & UX Conventions

- Chain reaction is the **only** place motion is spent generously
- Outside of explosions: subtle hover states, press states, and pulse on
  primed cells only
- All animations must have a `prefers-reduced-motion` fallback
- `triggerShockwave()` uses CSS `@keyframes shockwave` — class is removed on
  `animationend` to allow re-triggering
- Orb pop animation (`orbPop`) uses a spring-like cubic-bezier for tactile
  feel

---

## 7. Accessibility Requirements

- Color is never the only signal — player name is shown textually
- Cells show orb count visually and via `aria-label`
- Visible `:focus-visible` states on all interactive elements
- Overlays can be dismissed with Escape key
- Keyboard navigation: Enter/Space to place orbs, Tab through controls
- `prefers-reduced-motion` disables all animations

---

## 8. Git Commit Conventions

_(When version control is added)_
- `feat:` — new feature
- `fix:` — bug fix
- `refactor:` — code restructuring
- `docs:` — documentation changes
- `style:` — formatting, CSS changes
- `chore:` — build, tooling

---

## 9. Testing Philosophy

- `rules.js` is the primary candidate for unit tests (pure functions)
- Render functions are best tested visually (browser-based or screenshot)
- Manual playthroughs against the acceptance checklist (§10 of REQUIREMENTS.md)
  before tagging releases
