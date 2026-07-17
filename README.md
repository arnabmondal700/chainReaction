# Chain Reaction ⚡

A turn-based strategy game built with vanilla HTML, CSS, and JavaScript — zero frameworks, zero dependencies.

![Chain Reaction Game](https://img.shields.io/badge/status-active-brightgreen)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)

---

## 🎮 About

**Chain Reaction** is a turn-based strategy game played on a 6×9 grid. Players place charged orbs into cells; when a cell overflows its capacity it detonates, firing orbs into neighboring cells and converting any opponent orbs there to the current player's color. The goal is to be the last color standing on the board.

Inspired by the classic Chain Reaction game — reimagined with a modern, glassmorphic UI and a wave-based explosion engine.

---

## 🚀 Play

Open `index.html` in any modern browser (served via a static file server — ES6 modules require `http://`, not `file://`).

Or open the **production build** at `dist/index.html` which is a single self-contained file that works directly from disk.

### Quick start (development)

```bash
# Using VS Code Live Server, or any static server:
npx serve .
# or
python -m http.server 8000
```

### Production build

```bash
node build.js
```

Output: `dist/index.html` — a single self-contained deployable file.

---

## 🎯 How to Play

1. **Select player count** — 2, 3, or 4 players.
2. **Take turns** — click any empty cell or a cell you already own to place an orb.
3. **Explosions** — when a cell reaches its capacity (2 for corners, 3 for edges, 4 for interior), it explodes, sending orbs to all orthogonal neighbors and capturing them.
4. **Chain reactions** — explosions can cascade across the board in visible waves.
5. **Win** — be the last color standing. A player is eliminated when they have zero orbs on the board (after their first move).

### Strategy tips

- **Corners & edges** explode with fewer orbs (capacity 2–3), making them fast threats — but easy for opponents to snipe.
- **Interior cells** hold more orbs (capacity 4) and can trigger the biggest chain reactions.
- Watch cells that are **one orb away from exploding** — these are live threats on the very next turn.

---

## ✨ Features

- **2–4 player support** — selectable before each game
- **6×9 grid** — portrait-friendly, classic proportions
- **Wave-based explosion engine** — chain reactions resolve in visible, animated waves
- **Live orb counts** — per-player orb tracking
- **Elimination tracking** — eliminated players are automatically skipped
- **Game Over overlay** — winner announcement with rematch option
- **"How to Play" panel** — rules and strategy tips
- **Fully responsive** — works on mobile (360px+) and desktop
- **Glassmorphic UI** — modern visual design with subtle animations
- **Keyboard accessible** — full keyboard navigation support
- **`prefers-reduced-motion`** respected

---

## 🏗️ Architecture

```
chain-reaction/
├── index.html           # Entry point (HTML shell + module script tags)
├── css/
│   └── styles.css       # All styles (design tokens, layout, components)
├── js/
│   ├── constants.js     # Grid dimensions, player defs, timings
│   ├── state.js         # Game state management
│   ├── rules.js         # Pure game logic (zero DOM references)
│   ├── render.js        # DOM rendering (board, cells, panels)
│   ├── ui.js            # Interaction handlers, chain reaction loop
│   └── main.js          # Entry point, bootstraps and wires events
├── build.js             # Node.js concat script → dist/index.html
├── dist/                # Build output (single self-contained index.html)
└── .clinerules/         # Development rules & architecture docs
```

### Module dependency chain

```
constants → state → rules → render → ui → main
```

Each module only imports from earlier modules — strictly linear, no circular dependencies.

### Key design decisions

- **State in memory, not DOM** — JavaScript variables are the single source of truth; the DOM is purely a view.
- **Wave-based explosions** — iterative loop (not recursive) prevents stack overflow on large cascading chains.
- **Pure logic module** — `rules.js` has zero DOM references, making it testable in Node.js.
- **Single-file build** — `build.js` concatenates all modules into one self-contained `dist/index.html`.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Markup | HTML5 |
| Styling | CSS3 (Grid, custom properties, glassmorphism) |
| Logic | Vanilla JavaScript (ES6+ modules) |
| Build | Node.js (custom `build.js`) |
| Fonts | Space Grotesk + Inter (Google Fonts) |
| Dependencies | **Zero** — no frameworks, no libraries |

---

## 📦 Project Status

### ✅ Implemented (v1)

- [x] 2–4 player support
- [x] Click/tap to place orbs with full input validation
- [x] Capacity-based explosion + chain reaction engine
- [x] Turn indicator and live orb counts
- [x] Elimination tracking and automatic turn skipping
- [x] Win detection + Game Over overlay
- [x] New Game / rematch
- [x] "How to Play" panel
- [x] Fully responsive layout
- [x] Modern glassmorphic design

### 🔮 Future possibilities

- AI / computer opponent
- Online multiplayer
- Undo / move history
- Sound effects
- Adjustable grid size

---

## 📄 License

MIT