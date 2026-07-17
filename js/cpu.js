// cpu.js — CPU AI strategies (Easy / Medium / Hard)

'use strict';

import { ROWS, COLS } from './constants.js';
import {
  board, players, numPlayers, currentPlayerIndex,
  getCell, getCapacity, getNeighbors,
  collectOverflowing, explodeCell, canPlace,
} from './rules.js';
import { isCpuTurn, cpuDifficulty } from './state.js';

// ---- Fix 5: Safety valve for chain resolution ----
const MAX_CHAIN_STEPS = 200;

/**
 * Choose the best move for the current CPU player and trigger it.
 */
export function executeCpuMove() {
  if (!isCpuTurn()) return;

  let move = null;
  try {
    move = chooseBestMove();
  } catch (err) {
    console.error('CPU move selection failed, falling back to random:', err);
  }
  if (!move) {
    const valid = getValidMoves();
    if (valid.length > 0) move = pickRandom(valid);
  }
  if (move) {
    window.dispatchEvent(new CustomEvent('cpu-move', { detail: { r: move.row, c: move.col } }));
  }
}

/**
 * Select a move based on current difficulty.
 */
export function chooseBestMove() {
  const difficulty = cpuDifficulty;
  const valid = getValidMoves();
  if (valid.length === 0) return null;

  if (difficulty === 'easy') {
    return pickRandom(valid);
  }

  if (difficulty === 'medium') {
    return pickBestScored(valid);
  }

  // hard
  return pickMinimax(valid);
}

/**
 * Return all cells where the current player can place an orb.
 */
export function getValidMoves() {
  const moves = [];
  const playerId = currentPlayerIndex;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (canPlace(r, c, playerId)) {
        moves.push({ row: r, col: c });
      }
    }
  }
  return moves;
}

/**
 * Pick a random valid move.
 */
function pickRandom(moves) {
  return moves[Math.floor(Math.random() * moves.length)];
}

/**
 * Score each valid move using a heuristic and pick the best.
 */
function pickBestScored(moves) {
  let best = null;
  let bestScore = -Infinity;

  for (const m of moves) {
    const score = scoreMove(m.row, m.col);
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }

  return best;
}

/**
 * Heuristic score for placing at (r, c).
 */
function scoreMove(r, c) {
  const me = currentPlayerIndex;
  const cell = getCell(r, c);
  const cap = getCapacity(r, c);
  let score = 0;

  // If capturing an opponent cell, bonus
  if (cell.owner !== null && cell.owner !== me) {
    score += 100;
  }

  // If reinforcing own cell, small bonus
  if (cell.owner === me) {
    score += 20;
  }

  // Proximity to critical cells
  const neighbors = getNeighbors(r, c);
  for (const [nr, nc] of neighbors) {
    const n = getCell(nr, nc);
    const nCap = getCapacity(nr, nc);
    // enemy critical => high value to capture
    if (n.owner !== null && n.owner !== me && n.count === nCap - 1) {
      score += 80;
    }
    // own critical => defend
    if (n.owner === me && n.count === nCap - 1) {
      score += 40;
    }
  }

  // Avoid cells adjacent to strong enemy clusters
  for (const [nr, nc] of neighbors) {
    const n = getCell(nr, nc);
    if (n.owner !== null && n.owner !== me && n.count >= Math.max(2, Math.floor(getCapacity(nr, nc) / 2))) {
      score -= 30;
    }
  }

  // Prefer center-ish cells for more expansion options
  const centerR = Math.floor(ROWS / 2);
  const centerC = Math.floor(COLS / 2);
  const dist = Math.abs(r - centerR) + Math.abs(c - centerC);
  score -= dist * 1;

  // Tiny random jitter to break ties
  score += Math.random() * 2;

  return score;
}

/**
 * Simple minimax with alpha-beta pruning.
 * Depth is adaptive: 2 on mobile, 3 elsewhere.
 */
// Fix 1: Time-boxed search to prevent UI freezes
function pickMinimax(moves, budgetMs = 300) {
  const deadline = performance.now() + budgetMs;
  const depth = getMinimaxDepth();
  // Fix 2b: Cap branching factor — only consider top-K candidates
  const kMoves = topCandidateMoves(moves, 8);
  // Fix 4: Sort by heuristic for better alpha-beta pruning
  const orderedMoves = kMoves
    .map(m => ({ m, s: scoreMove(m.row, m.col) }))
    .sort((a, b) => b.s - a.s)
    .map(x => x.m);

  let bestMove = orderedMoves[0];
  let bestValue = -Infinity;

  for (const m of orderedMoves) {
    if (performance.now() > deadline) break;
    const value = minimax(m.row, m.col, depth - 1, -Infinity, Infinity, false, deadline);
    if (value > bestValue) {
      bestValue = value;
      bestMove = m;
    }
  }

  return bestMove;
}

/**
 * Fix 2b: Return only the top-K moves by heuristic score.
 */
function topCandidateMoves(moves, k = 10) {
  if (moves.length <= k) return moves;
  return moves
    .map(m => ({ m, s: scoreMove(m.row, m.col) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, k)
    .map(x => x.m);
}

/**
 * Fix 7: Adaptive depth based on board occupancy.
 * Reduces search depth when board is nearly full to keep turns fast.
 */
function getMinimaxDepth() {
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const base = isMobile ? 2 : 3;
  const occupancyRatio = computeOccupancy(board);
  if (occupancyRatio > 0.75) return Math.max(1, base - 1);
  return base;
}

/**
 * Compute ratio of non-empty cells to total cells.
 */
function computeOccupancy(boardRef) {
  let filled = 0;
  const total = ROWS * COLS;
  for (let r = 0; r < ROWS; r++) {
    const rowArr = boardRef[r];
    if (!rowArr) continue;
    for (let c = 0; c < COLS; c++) {
      const cell = rowArr[c];
      if (cell && cell.owner !== null) filled++;
    }
  }
  return filled / total;
}

/**
 * Apply a move virtually on a cloned board state and return new board.
 */
function cloneState() {
  return board.map(row => row.map(cell => ({ ...cell })));
}

function applyMove(srcBoard, r, c, playerId) {
  const cell = srcBoard[r][c];
  if (!cell) return;
  cell.count += 1;
  cell.owner = playerId;

  // Fix 2a: Use frontier tracking instead of full-board rescans.
  // Only re-check cells that could newly be overflowing.
  let frontier = new Set();
  frontier.add(`${r},${c}`);
  let steps = 0;

  while (frontier.size > 0 && steps < MAX_CHAIN_STEPS) {
    const overflowing = [];
    // Collect overflowing cells from current frontier
    for (const key of frontier) {
      const [fr, fc] = key.split(',').map(Number);
      const cCell = srcBoard[fr]?.[fc];
      if (cCell && cCell.count >= getCapacity(fr, fc) && cCell.count > 0) {
        overflowing.push([fr, fc]);
      }
    }
    if (overflowing.length === 0) break;

    const nextFrontier = new Set();
    for (const [fr, fc] of overflowing) {
      const cCell = srcBoard[fr][fc];
      const cap = getCapacity(fr, fc);
      cCell.count -= cap;
      if (cCell.count <= 0) {
        cCell.count = 0;
        cCell.owner = null;
      }
      for (const [nr, nc] of getNeighbors(fr, fc)) {
        const rowArr = srcBoard[nr];
        if (!rowArr) continue;
        const n = rowArr[nc];
        if (!n) continue;
        n.count += 1;
        n.owner = playerId;
        nextFrontier.add(`${nr},${nc}`);
      }
    }
    frontier = nextFrontier;
    steps++;
  }
}

function collectOverflowingFrom(srcBoard) {
  const list = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = srcBoard[r] && srcBoard[r][c];
      if (!cell) continue;
      const cap = getCapacity(r, c);
      if (cell.count >= cap && cell.count > 0) {
        list.push([r, c]);
      }
    }
  }
  return list;
}

function evaluate(srcBoard) {
  const me = currentPlayerIndex;
  let myOrbs = 0;
  let enemyOrbs = 0;
  let myCritical = 0;
  let enemyCritical = 0;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = srcBoard[r][c];
      const cap = getCapacity(r, c);
      if (cell.owner === me) {
        myOrbs += cell.count;
        if (cell.count === cap - 1) myCritical += 1;
      } else if (cell.owner !== null) {
        enemyOrbs += cell.count;
        if (cell.count === cap - 1) enemyCritical += 1;
      }
    }
  }

  const score = (myOrbs - enemyOrbs) + (myCritical * 30) - (enemyCritical * 30);
  return score;
}

/**
 * Score a move from the perspective of playerId (used for ordering in minimax).
 */
function scoreMoveFor(r, c, playerId) {
  const me = playerId;
  const cell = getCell(r, c);
  const cap = getCapacity(r, c);
  let score = 0;

  if (cell.owner !== null && cell.owner !== me) score += 100;
  if (cell.owner === me) score += 20;

  const neighbors = getNeighbors(r, c);
  for (const [nr, nc] of neighbors) {
    const n = getCell(nr, nc);
    const nCap = getCapacity(nr, nc);
    if (n.owner !== null && n.owner !== me && n.count === nCap - 1) score += 80;
    if (n.owner === me && n.count === nCap - 1) score += 40;
  }

  for (const [nr, nc] of neighbors) {
    const n = getCell(nr, nc);
    if (n.owner !== null && n.owner !== me && n.count >= Math.max(2, Math.floor(getCapacity(nr, nc) / 2))) {
      score -= 30;
    }
  }

  const centerR = Math.floor(ROWS / 2);
  const centerC = Math.floor(COLS / 2);
  score -= (Math.abs(r - centerR) + Math.abs(c - centerC)) * 1;
  score += Math.random() * 2;
  return score;
}

function minimax(r, c, depth, alpha, beta, isMaximizing, deadline = Infinity) {
  const me = currentPlayerIndex;
  const boardCopy = cloneState();
  applyMove(boardCopy, r, c, me);

  // Check deadline for time-boxed search
  if (performance.now() > deadline) return evaluate(boardCopy);

  // Check terminal-ish
  const winner = getWinnerFromBoard(boardCopy);
  if (winner !== null) return winner === me ? 100000 : -100000;
  if (depth === 0) return evaluate(boardCopy);

  // Generate moves for next player (rotate turn)
  const nextPlayer = (me + 1) % numPlayers;
  // We can't change state, so we simulate from boardCopy
  // Fix 4 & 2b: Cap and order child moves for better pruning
  let moves = getValidMovesFrom(boardCopy, nextPlayer);
  if (moves.length === 0) return evaluate(boardCopy);

  // Order moves for better alpha-beta pruning
  moves = moves
    .map(m => ({ m, s: scoreMoveFor(m.row, m.col, nextPlayer) }))
    .sort((a, b) => (isMaximizing ? b.s - a.s : a.s - b.s))
    .map(x => x.m);

  // Fix 2b: Cap to top-K child moves
  const childK = 8;
  const cappedMoves = moves.length > childK ? moves.slice(0, childK) : moves;

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const m of cappedMoves) {
      const value = minimaxSim(boardCopy, m.row, m.col, depth - 1, alpha, beta, false, nextPlayer, deadline);
      maxEval = Math.max(maxEval, value);
      alpha = Math.max(alpha, value);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const m of cappedMoves) {
      const value = minimaxSim(boardCopy, m.row, m.col, depth - 1, alpha, beta, true, nextPlayer, deadline);
      minEval = Math.min(minEval, value);
      beta = Math.min(beta, value);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

function minimaxSim(srcBoard, r, c, depth, alpha, beta, isMax, playerId, deadline = Infinity) {
  const boardCopy = srcBoard.map(row => row.map(cell => ({ ...cell })));
  applyMove(boardCopy, r, c, playerId);

  const me = currentPlayerIndex;
  // Check deadline for time-boxed search
  if (performance.now() > deadline) return evaluate(boardCopy);

  const winner = getWinnerFromBoard(boardCopy);
  if (winner !== null) return winner === me ? 100000 : -100000;
  if (depth === 0) return evaluate(boardCopy);

  const nextPlayer = (playerId + 1) % numPlayers;
  let moves = getValidMovesFrom(boardCopy, nextPlayer);
  if (moves.length === 0) return evaluate(boardCopy);

  // Order moves for better alpha-beta pruning
  moves = moves
    .map(m => ({ m, s: scoreMoveFor(m.row, m.col, nextPlayer) }))
    .sort((a, b) => (isMax ? b.s - a.s : a.s - b.s))
    .map(x => x.m);

  const childK = 8;
  const cappedMoves = moves.length > childK ? moves.slice(0, childK) : moves;

  if (isMax) {
    let maxEval = -Infinity;
    for (const m of cappedMoves) {
      const value = minimaxSim(boardCopy, m.row, m.col, depth - 1, alpha, beta, false, nextPlayer, deadline);
      maxEval = Math.max(maxEval, value);
      alpha = Math.max(alpha, value);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const m of cappedMoves) {
      const value = minimaxSim(boardCopy, m.row, m.col, depth - 1, alpha, beta, true, nextPlayer, deadline);
      minEval = Math.min(minEval, value);
      beta = Math.min(beta, value);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

function getValidMovesFrom(srcBoard, playerId) {
  const moves = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const rowArr = srcBoard[r];
      if (!rowArr) continue;
      const cell = rowArr[c];
      if (!cell) continue;
      if (cell.owner === null || cell.owner === playerId) {
        moves.push({ row: r, col: c });
      }
    }
  }
  return moves;
}

function getWinnerFromBoard(srcBoard) {
  const ownersPresent = new Set();
  for (let r = 0; r < ROWS; r++) {
    const rowArr = srcBoard[r];
    if (!rowArr) continue;
    for (let c = 0; c < COLS; c++) {
      const cell = rowArr[c];
      if (!cell) continue;
      if (cell.owner !== null) {
        ownersPresent.add(cell.owner);
      }
    }
  }
  if (ownersPresent.size === 1) {
    return [...ownersPresent][0];
  }
  return null;
}