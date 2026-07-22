// rules.js — Pure game logic (no DOM references)

'use strict';

import { ROWS, COLS } from './constants.js';
import {
  board, players, numPlayers,
  currentPlayerIndex, hasMoved, gameOver,
  getCell, clearOrbCountCache, setCurrentPlayerIndex,
  setGameOver,
} from './state.js';

/**
 * Return the explosion capacity of a cell based on its position.
 * Corner = 2, Edge = 3, Interior = 4.
 */
export function getCapacity(r, c) {
  let n = 0;
  if (r > 0) n++;
  if (r < ROWS - 1) n++;
  if (c > 0) n++;
  if (c < COLS - 1) n++;
  return n;
}

/**
 * Return array of [row, col] pairs for orthogonally-adjacent cells.
 */
export function getNeighbors(r, c) {
  const res = [];
  if (r > 0) res.push([r - 1, c]);
  if (r < ROWS - 1) res.push([r + 1, c]);
  if (c > 0) res.push([r, c - 1]);
  if (c < COLS - 1) res.push([r, c + 1]);
  return res;
}

/**
 * Explode a single cell at (r, c):
 *  - Reduces its count by its capacity.
 *  - If count drops to ≤ 0, resets owner to null.
 *  - Sends one orb to each orthogonal neighbor, capturing them.
 * This mutates board state directly.
 */
export function explodeCell(r, c) {
  const cell = getCell(r, c);
  const capacity = getCapacity(r, c);
  const owner = cell.owner;

  cell.count -= capacity;
  if (cell.count <= 0) {
    cell.count = 0;
    cell.owner = null;
  }

  getNeighbors(r, c).forEach(([nr, nc]) => {
    const neighbor = getCell(nr, nc);
    neighbor.count += 1;
    neighbor.owner = owner;
  });

  clearOrbCountCache();

  // Return the exploding cell + neighbors so callers know what changed
  return [[r, c], ...getNeighbors(r, c)];
}

/**
 * Collect all cells currently at or above capacity (overflowing).
 * Returns an array of [row, col] pairs.
 */
export function collectOverflowing() {
  const list = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = getCell(r, c);
      if (cell.count >= getCapacity(r, c) && cell.count > 0) {
        list.push([r, c]);
      }
    }
  }
  return list;
}

/**
 * Check if a player is eliminated: must have moved at least once
 * and now own zero orbs on the board.
 */
export function isEliminated(playerId) {
  if (!hasMoved[playerId]) return false;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c].owner === playerId) return false;
    }
  }
  return true;
}

/**
 * Check win condition: after all players have moved, if only one
 * player's color remains among occupied cells, that player wins.
 * Mutates `gameOver` flag in state.
 * @returns {number|null} — winning player ID, or null if no winner yet.
 */
export function checkWinCondition() {
  if (hasMoved.filter(Boolean).length < numPlayers) return null;

  const ownersPresent = new Set();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c].owner !== null) {
        ownersPresent.add(board[r][c].owner);
      }
    }
  }

  if (ownersPresent.size === 1) {
    const winnerId = [...ownersPresent][0];
    return winnerId;
  }
  return null;
}

/**
 * Set the game-over flag. Called from ui.js when checkWinCondition returns a winner.
 * Broken out so rules.js doesn't import gameOver directly for mutation.
 */
export function setGameOverFromRules() {
  setGameOver(true);
}

/**
 * Advance to the next active (non-eliminated) player.
 * Mutates currentPlayerIndex in state.
 */
export function advanceTurn() {
  let next = currentPlayerIndex;
  for (let i = 0; i < numPlayers; i++) {
    next = (next + 1) % numPlayers;
    if (!isEliminated(next)) {
      setCurrentPlayerIndex(next);
      return;
    }
  }
  // Fallback: if we looped through all players without finding one,
  // stay on the current (this should not happen in normal play).
}

/**
 * Validate whether a player can place an orb in a given cell.
 */
export function canPlace(r, c, playerId) {
  const cell = getCell(r, c);
  return cell.owner === null || cell.owner === playerId;
}
