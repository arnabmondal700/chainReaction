// main.js — Entry point: bootstraps the game and wires everything together

'use strict';

import { initGameState, setPlayerTypes, setCpuDifficulty } from './state.js';
import { buildBoardDOM, renderAll } from './render.js';
import { initUI } from './ui.js';

// Wire up DOM event listeners and cache refs (DOM exists in index.html)
initUI();

// Read selected mode and difficulty from UI
const gameModeEl = document.getElementById('gameMode');
const cpuDiffEl = document.getElementById('cpuDifficulty');

let selectedMode = 'pvp';
if (gameModeEl) {
  selectedMode = gameModeEl.value;
  gameModeEl.addEventListener('change', () => {
    const mode = gameModeEl.value;
    const diff = cpuDiffEl ? cpuDiffEl.value : 'medium';
    applyMode(mode, diff);
    startFreshGame();
  });
}

if (cpuDiffEl) {
  cpuDiffEl.addEventListener('change', () => {
    const diff = cpuDiffEl.value;
    setCpuDifficulty(diff);
  });
}

function applyMode(mode, diff) {
  setCpuDifficulty(diff);
  if (mode === 'cpu') {
    setPlayerTypes(['human', 'cpu']);
  } else {
    setPlayerTypes(['human', 'human', 'human', 'human']);
  }
  updatePlayerButtons(mode);
}

function updatePlayerButtons(mode) {
  const isCpu = mode === 'cpu';
  const btns = document.querySelectorAll('.player-btn');
  btns.forEach(btn => {
    const count = Number(btn.dataset.players);
    if (isCpu && count > 2) {
      btn.classList.add('disabled');
    } else {
      btn.classList.remove('disabled');
    }
  });
  // If CPU mode and current selection is 3 or 4, force to 2
  if (isCpu && numPlayers > 2) {
    initGame(2);
  }
}

function getSelectedPlayerCount() {
  const activeBtn = document.querySelector('.player-btn.active');
  if (!activeBtn) return 2;
  return Number(activeBtn.dataset.players);
}

function startFreshGame() {
  const n = getSelectedPlayerCount();
  initGameState(n);
  buildBoardDOM();
  renderAll();
}

applyMode(selectedMode, cpuDiffEl ? cpuDiffEl.value : 'medium');

// Start the initial game (initializes state + builds DOM + renders)
startFreshGame();
