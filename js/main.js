// main.js — Entry point: bootstraps the game and wires everything together

'use strict';

import { initGameState } from './state.js';
import { buildBoardDOM, renderAll } from './render.js';
import { initUI } from './ui.js';

// Wire up DOM event listeners and cache refs (DOM exists in index.html)
initUI();

// Initialize state for 2-player game
initGameState(2);

// Build the initial board DOM
buildBoardDOM();

// Render the starting state
renderAll();
