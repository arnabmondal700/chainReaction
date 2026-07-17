# Chain Reaction — Memory Map

> Architecture overview, state documentation, data flow, and module dependency
> graph for the Chain Reaction game.
>
> **Purpose:** This file is the persistent memory bank loaded by Cline to maintain
> project context across sessions. Keep updated as the architecture evolves.

---

## 1. File Map

```
chain-reaction/
│
├── index.html              ENTRY — HTML shell, meta tags, font preloads,
│                           imports js/main.js (module), links styles.css
│
├── RULES.md                DOC — Coding conventions, architecture decisions
├── MEMORY.md               DOC — This file (architecture reference)
├── REQUIREMENTS.md         DOC — Product requirements (source of truth)
│
├── css/
│   └── styles.css          STYLE — All CSS (design tokens, layout, components)
│
├── js/
│   ├── constants.js        MODULE — Grid dims, player defs, timings, class names
│   ├── state.js            MODULE — Game state (board, players, turn, flags)
│   ├── rules.js            MODULE — Pure game logic (capacity, explosions, win)
│   ├── render.js           MODULE — DOM rendering (board, cells, panels)
│   ├── ui.js               MODULE — Interaction handlers, chain reaction loop
│   └── main.js             MODULE — Entry point, bootstraps and wires events
│
├── build.js                BUILD — Node.js concat script → dist/index.html
│
├── audio/                  ASSETS — Web Audio sound effect files (place, explode,
│                           win, invalid, click)
│
├── .clinerules/
│   ├── RULES.md            DOC — Development rules & conventions (ADRs, style)
│   └── MEMORY.md           DOC — This file (architecture memory bank)
│
└── dist/
    └── index.html          BUILD OUTPUT — Single self-contained deployable file
```

---

## 2. Module Dependency Graph

```
constants.js  (no deps)
     ↓
state.js      (constants.js)
     ↓
rules.js      (constants.js, state.js)
     ↓
render.js     (constants.js, state.js, rules.js)
     ↓
ui.js         (constants.js, state.js, rules.js, render.js)
     ↓
sound.js      (no deps from app modules; fetches audio files)
     ↓
main.js       (all of the above)
```

Import chain is strictly linear — each module only imports from earlier modules.
This guarantees the build concatenation works without circular dependencies.

---

## 3. Data Flow

### 3.1 Turn Flow

```
User clicks cell
      ↓
handleCellClick(r, c)
      ↓
  [validation: is gameOver? is busy? can place here?]
      ↓
  increment cell count, set owner, mark hasMoved
      ↓
  renderAll()
      ↓
  resolveExplosions()
      ↓
    collectOverflowing() — re-scans board for cells at capacity
    while overflowing:
        for each overflowing cell:
            explodeCell() — reduces count, sends orbs to neighbors
```

### 3.2 Explosion Flow Detail (Wave-Based Engine)

```
[Wave N start]
  collectOverflowing() → finds all cells where count >= capacity
  For each:
    1. Record owner color
    2. explodeCell(r, c):
       - board[r][c].count -= getCapacity(r, c)
       - if count <= 0: count=0, owner=null
       - for each neighbor: count++, owner = exploding cell's owner
    3. triggerShockwave(r, c, color) — CSS animation
  renderAll()
  sleep(260ms)
  checkWinCondition() — if 1 color remains, gameOver=true, return
  collectOverflowing() → next wave
[Wave N end]
```

**Key:** Iterative wave-based loop (not recursive). Scans for overflowing cells,
explodes them simultaneously, renders, re-scans. This prevents stack overflow on
large cascading chains (~54 cells worst case). O(n) per wave.

### 3.3 Win Detection Flow

```
checkWinCondition()
  → if any player hasn't moved yet → return false (can't win turn 1)
  → collect unique owners of all non-empty cells
  → if only 1 unique owner → gameOver=true, show over overlay
```

---

## 4. State Shape

### 4.1 JavaScript State Variables

```js
board: [
  [ { count: 0, owner: null }, { count: 1, owner: 0 }, ... ],  // row 0
  [ ... ],                                                       // row 1
  // ... 7 more rows (total: ROWS × COLS)
]

players: [
  { name: 'Ember',  color: '#ff5a5f', id: 0 },
  { name: 'Ion',    color: '#2fe0ff', id: 1 },
  { name: 'Volt',   color: '#ffd23f', id: 2 },
  { name: 'Plasma', color: '#b168ff', id: 3 },
]

numPlayers: 2         // 2 | 3 | 4
currentPlayerIndex: 0 // 0..numPlayers-1
hasMoved: [true, true, false, false]  // one per player
gameOver: false
busy: false           // true during explosion resolution
```

### 4.2 Cell State

```js
{
  count: 0,       // number of orbs (0..capacity)
  owner: null     // null | 0 | 1 | 2 | 3  (player ID)
}
```

### 4.3 Derived Values

| Value | Calculation |
|---|---|
| Cell capacity | `getCapacity(r, c)` = 2 (corner) / 3 (edge) / 4 (interior) |
| Player orb count | Sum of `count` across all cells where `owner === playerId` |
| Player eliminated | `hasMoved[playerId]` && no cells have `owner === playerId` |
| Cell is "primed" | `count === capacity - 1` (one orb from exploding) |
| Cell is overflowing | `count >= capacity` (needs to explode) |

---

## 5. DOM State

The DOM mirrors game state — it is never the source of truth. All game state is
kept in JavaScript variables. The DOM is purely a view.

| DOM Element | What it represents |
|---|---|
| `.cell[data-row][data-col]` | One board cell; `aria-label` says owner & count |
| `.cell > .orbs` | Contains `.orb` child elements (1 per orb, max capacity) |
| `.cell.primed` | Cell is one orb from exploding (visual pulse) |
| `.cell.disabled` | Cell can't be clicked (opponent-owned or game over) |
| `.cell.exploding` | Shockwave animation is playing via `::after` pseudo-element |
| `.player-chip` | One per player; `.active` = current turn, `.eliminated` = out |
| `.chip-count` | Orb count text for that player |
| `.turn-indicator` | Whose turn it is (dot + name) |
| `.overlay` | Hidden by default, shown on game over or rules |

---

## 6. CSS Architecture

### 6.1 Design Tokens (Custom Properties)

```
--bg-void         #0a0d13       App background
--bg-panel        rgba(..)       Glass panel fill (translucent)
--bg-panel-strong rgba(..)       Stronger glass fill
--border-glass    rgba(..)       Subtle glass border
--text-primary    #eef1f7        Primary text
--text-muted      #828a9a        Secondary text
--p1              #ff5a5f        Player 1 (Ember)
--p2              #2fe0ff        Player 2 (Ion)
--p3              #ffd23f        Player 3 (Volt)
--p4              #b168ff        Player 4 (Plasma)
```

### 6.2 Responsive Breakpoints

- **768px** — side rail moves below the board on narrow screens
- **360px** — smallest supported viewport

### 6.3 Key Components

| Component | CSS approach |
|---|---|
| Board | CSS Grid (6 cols × 9 rows), gap: 6px |
| Orbs inside cell | Inner CSS Grid (2×2) — positions vary by count (1–4) |
| Panels | Glassmorphism: `backdrop-filter: blur(14px)`, translucent bg |
| Shockwave | `::after` pseudo-element with `scale` + `opacity` animation |
| Brand mark | Conic gradient with spin animation |

---

## 7. Event Handling

| Event | Target | Handler |
|---|---|---|
| `click` | `.cell` | `handleCellClick()` — place orb |
| `keydown` | `.cell` (Enter/Space) | `handleCellClick()` — keyboard support |
| `click` | `.player-btn` | `initGame(n)` — restart with N players |
| `click` | `#newGameBtn` | `initGame(currentNum)` — restart with same player count |
| `click` | `#rematchBtn` | `initGame(currentNum)` — same as new game |
| `click` | `#howToPlayBtn` | Show rules overlay |
| `click` | `.close-btn` / `#closeRulesBtn2` | Hide rules overlay |
| `keydown` | Overlay (Escape) | Hide active overlay |

---

## 8. Build Pipeline

### 8.1 Development

Open `index.html` in a browser served via any static file server (Live Server,
`python -m http.server`, etc.). ES6 modules need `http://` not `file://`.

### 8.2 Production Build

```bash
node build.js
```

Output: `dist/index.html` — single self-contained file (CSS inlined, JS
concatenated and wrapped in IIFE).

### 8.3 Build Script Logic

```
1. Read index.html → parse out <style> placeholder comment and <script> placeholder
2. Read css/styles.css → inline into <style> block
3. Read js/ in dependency order (constants → state → rules → render → ui → main)
   → concatenate into single <script> block wrapped in IIFE
4. Write dist/index.html