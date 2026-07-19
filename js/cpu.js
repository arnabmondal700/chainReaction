// cpu.js — CPU AI strategies (Easy / Medium / Hard) — test copy with threat-lookahead added

'use strict';

import { ROWS, COLS } from './constants.js';
import {
  getCapacity, getNeighbors,
  collectOverflowing, explodeCell, canPlace,
} from './rules.js';
import {
  board, players, numPlayers, currentPlayerIndex, getCell,
  isCpuTurn, cpuDifficulty, hasMoved,
} from './state.js';

const MAX_CHAIN_STEPS = 200;
export let NODE_COUNT = 0;

export function executeCpuMove() {
  if (!isCpuTurn()) return;
  let move = null;
  try { move = chooseBestMove(); } catch (err) { console.error('CPU move selection failed, falling back to random:', err); }
  if (!move) {
    const valid = getValidMoves();
    if (valid.length > 0) move = pickRandom(valid);
  }
  if (move) window.dispatchEvent(new CustomEvent('cpu-move', { detail: { r: move.row, c: move.col } }));
}

export function chooseBestMove() {
  const difficulty = cpuDifficulty;
  const valid = getValidMoves();
  if (valid.length === 0) return null;
  if (difficulty === 'easy') return pickRandom(valid);
  if (difficulty === 'medium') return pickBestScored(valid);
  return pickMinimax(valid);
}

export function getValidMoves() {
  const moves = [];
  const playerId = currentPlayerIndex;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (canPlace(r, c, playerId)) moves.push({ row: r, col: c });
  return moves;
}

function pickRandom(moves) { return moves[Math.floor(Math.random() * moves.length)]; }

function pickBestScored(moves) {
  let best = null, bestScore = -Infinity;
  for (const m of moves) {
    const score = scoreMove(m.row, m.col);
    if (score > bestScore) { bestScore = score; best = m; }
  }
  return best;
}

// ---- NEW: opponent-threat lookahead ----
// "If the opponent places a dot in this block, will it explode and capture
// one of my blocks?" — scanned directly, not just hoped-for via deep search.
function findOpponentThreats(srcBoard, me) {
  const opponent = (me + 1) % numPlayers;
  const threats = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = srcBoard[r][c];
      if (!cell || cell.owner !== opponent) continue;
      const cap = getCapacity(r, c);
      if (cell.count !== cap - 1) continue; // one orb from exploding on their next turn
      const capturedCells = getNeighbors(r, c).filter(([nr, nc]) => {
        const n = srcBoard[nr]?.[nc];
        return n && n.owner === me;
      });
      if (capturedCells.length > 0) threats.push({ atRow: r, atCol: c, capturedCells });
    }
  }
  return threats;
}

function threatSeverity(threats) {
  return threats.reduce((sum, t) => sum + t.capturedCells.length, 0);
}

// Only used at the TOP level (scoreMove), never inside scoreMoveFor — this
// does a board clone + two full-board scans, which is fine once per
// candidate move, but would be far too expensive if called at every node
// inside the deep minimax tree (thousands of calls).
function evaluateThreatDelta(r, c, me) {
  const beforeSeverity = threatSeverity(findOpponentThreats(board, me));
  const boardCopy = cloneState();
  applyMove(boardCopy, r, c, me);
  const afterSeverity = threatSeverity(findOpponentThreats(boardCopy, me));
  return (beforeSeverity - afterSeverity) * 45;
}

function scoreMove(r, c) {
  const me = currentPlayerIndex;
  const cell = getCell(r, c);
  const cap = getCapacity(r, c);
  let score = 0;

  if (cell.owner === me) score += 20;

  const neighbors = getNeighbors(r, c);
  const wouldExplode = (cell.count + 1) >= cap;
  if (wouldExplode) {
    score += 150;
    const capturedNeighbors = neighbors.filter(([nr, nc]) => {
      const n = getCell(nr, nc);
      return n.owner !== null && n.owner !== me;
    }).length;
    score += capturedNeighbors * 60;
  }

  for (const [nr, nc] of neighbors) {
    const n = getCell(nr, nc);
    const nCap = getCapacity(nr, nc);
    if (n.owner !== null && n.owner !== me && n.count === nCap - 1) score += wouldExplode ? 80 : 25;
    if (n.owner === me && n.count === nCap - 1) score += 40;
  }

  for (const [nr, nc] of neighbors) {
    const n = getCell(nr, nc);
    const nCap = getCapacity(nr, nc);
    if (n.owner !== null && n.owner !== me && n.count >= nCap - 1) {
      score -= 30 + (4 - nCap) * 10;
    }
  }

  // NEW: don't create a newly-critical cell of mine that sits directly next
  // to an opponent's already-critical cell. Verified by direct simulation:
  // if the opponent detonates into a cell that's ALSO critical, that cell
  // immediately re-explodes as part of THEIR cascade (bigger loss for me)
  // instead of just absorbing one orb.
  const willBeCritical = (cell.count + 1) === (cap - 1);
  if (cell.owner === me && willBeCritical) {
    const adjacentToEnemyCritical = neighbors.some(([nr, nc]) => {
      const n = getCell(nr, nc);
      const nCap = getCapacity(nr, nc);
      return n.owner !== null && n.owner !== me && n.count >= nCap - 1;
    });
    if (adjacentToEnemyCritical) score -= 70;
  }

  // NEW: opponent-threat lookahead
  score += evaluateThreatDelta(r, c, me);

  const centerR = Math.floor(ROWS / 2);
  const centerC = Math.floor(COLS / 2);
  const dist = Math.abs(r - centerR) + Math.abs(c - centerC);
  score -= dist * 0.15;
  score += Math.random() * 2;

  return score;
}

function pickMinimax(moves, budgetMs = 300) {
  NODE_COUNT = 0;
  const t0 = performance.now();
  const deadline = t0 + budgetMs;
  const occupancyRatio = computeOccupancy(board);
  const maxDepth = getMinimaxDepth(occupancyRatio);
  const k = occupancyRatio < 0.15 ? 14 : 8;
  const kMoves = topCandidateMoves(moves, k);
  let orderedMoves = kMoves
    .map(m => ({ m, s: scoreMove(m.row, m.col) }))
    .sort((a, b) => b.s - a.s)
    .map(x => x.m);

  const keyOf = (m) => `${m.row},${m.col}`;
  const latestValue = new Map();
  for (const m of orderedMoves) latestValue.set(keyOf(m), -Infinity);

  for (let depth = 1; depth <= maxDepth; depth++) {
    let hitDeadline = false;
    for (const m of orderedMoves) {
      if (performance.now() > deadline) { hitDeadline = true; break; }
      const value = minimax(m.row, m.col, depth - 1, -Infinity, Infinity, false, deadline);
      latestValue.set(keyOf(m), value); // only overwritten once actually (re-)evaluated
    }
    orderedMoves = [...orderedMoves].sort((a, b) => latestValue.get(keyOf(b)) - latestValue.get(keyOf(a)));
    if (hitDeadline) break;
  }

  let bestMove = orderedMoves[0];
  let bestValue = -Infinity;
  for (const m of orderedMoves) {
    const v = latestValue.get(keyOf(m));
    if (v > bestValue) { bestValue = v; bestMove = m; }
  }

  return bestMove;
}

function topCandidateMoves(moves, k = 10) {
  if (moves.length <= k) return moves;
  const scored = moves.map(m => ({ m, s: scoreMove(m.row, m.col) }));
  scored.sort((a, b) => b.s - a.s);
  const isTacticallyHot = (m) => {
    const cell = getCell(m.row, m.col);
    const cap = getCapacity(m.row, m.col);
    if (cell.count + 1 >= cap) return true;
    return getNeighbors(m.row, m.col).some(([nr, nc]) => {
      const n = getCell(nr, nc);
      return n.owner !== null && n.count >= getCapacity(nr, nc) - 1;
    });
  };
  const top = scored.slice(0, k).map(x => x.m);
  const hot = scored.filter(x => isTacticallyHot(x.m)).map(x => x.m);
  const merged = [...top];
  const maxExtra = Math.ceil(k * 0.5);
  let added = 0;
  for (const m of hot) {
    if (added >= maxExtra) break;
    if (!merged.some(x => x.row === m.row && x.col === m.col)) { merged.push(m); added++; }
  }
  return merged;
}

// NEW: cheap hot-move force-include for CHILD move capping too (no extra
// board clones — reuses the already-scored/sorted list).
function capChildMoves(scoredSortedMoves, srcBoard, childK = 8) {
  if (scoredSortedMoves.length <= childK) return scoredSortedMoves.map(x => x.m);
  const top = scoredSortedMoves.slice(0, childK);
  const maxExtra = 3; // small, fixed budget — this runs inside the deep tree
  let added = 0;
  const merged = top.map(x => x.m);
  for (const { m } of scoredSortedMoves.slice(childK)) {
    if (added >= maxExtra) break;
    const cell = srcBoard[m.row][m.col];
    const cap = getCapacity(m.row, m.col);
    const isHot = (cell.count + 1) >= cap; // would explode
    if (isHot) { merged.push(m); added++; }
  }
  return merged;
}

function getMinimaxDepth(occupancyRatio) {
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent || '');
  const base = isMobile ? 2 : 3;
  if (occupancyRatio > 0.75) return Math.max(1, base - 1);
  if (occupancyRatio < 0.15) return base + (isMobile ? 1 : 2);
  return base;
}

function computeOccupancy(boardRef) {
  let filled = 0;
  const total = ROWS * COLS;
  for (let r = 0; r < ROWS; r++) {
    const rowArr = boardRef[r];
    if (!rowArr) continue;
    for (let c = 0; c < COLS; c++) { const cell = rowArr[c]; if (cell && cell.owner !== null) filled++; }
  }
  return filled / total;
}

function cloneState() { return board.map(row => row.map(cell => ({ ...cell }))); }

function applyMove(srcBoard, r, c, playerId) {
  const cell = srcBoard[r][c];
  if (!cell) return;
  cell.count += 1;
  cell.owner = playerId;

  let frontier = new Set();
  frontier.add(`${r},${c}`);
  let steps = 0;

  while (frontier.size > 0 && steps < MAX_CHAIN_STEPS) {
    const overflowing = [];
    for (const key of frontier) {
      const [fr, fc] = key.split(',').map(Number);
      const cCell = srcBoard[fr]?.[fc];
      if (cCell && cCell.count >= getCapacity(fr, fc) && cCell.count > 0) overflowing.push([fr, fc]);
    }
    if (overflowing.length === 0) break;

    const nextFrontier = new Set();
    for (const [fr, fc] of overflowing) {
      const cCell = srcBoard[fr][fc];
      const cap = getCapacity(fr, fc);
      cCell.count -= cap;
      if (cCell.count <= 0) { cCell.count = 0; cCell.owner = null; }
      for (const [nr, nc] of getNeighbors(fr, fc)) {
        const rowArr = srcBoard[nr];
        if (!rowArr) continue;
        const n = rowArr[nc];
        if (!n) continue;
        n.count += 1; n.owner = playerId;
        nextFrontier.add(`${nr},${nc}`);
      }
    }
    frontier = nextFrontier;
    steps++;
  }
}

function evaluate(srcBoard) {
  const me = currentPlayerIndex;
  let myOrbs = 0, enemyOrbs = 0, myCriticalWeighted = 0, enemyCriticalWeighted = 0;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = srcBoard[r][c];
      const cap = getCapacity(r, c);
      const isCritical = cell.count === cap - 1;
      let clusterBonus = 0;
      if (isCritical && cell.owner !== null) {
        clusterBonus = getNeighbors(r, c).filter(([nr, nc]) => {
          const n = srcBoard[nr]?.[nc];
          return n && n.owner === cell.owner && n.count >= getCapacity(nr, nc) - 2;
        }).length;
      }
      const weight = 20 + cap * 5 + clusterBonus * 15;
      if (cell.owner === me) { myOrbs += cell.count; if (isCritical) myCriticalWeighted += weight; }
      else if (cell.owner !== null) { enemyOrbs += cell.count; if (isCritical) enemyCriticalWeighted += weight; }
    }
  }
  return (myOrbs - enemyOrbs) + myCriticalWeighted - enemyCriticalWeighted;
}

function scoreMoveFor(r, c, playerId) {
  const me = playerId;
  const cell = getCell(r, c);
  const cap = getCapacity(r, c);
  let score = 0;
  if (cell.owner === me) score += 20;

  const neighbors = getNeighbors(r, c);
  const wouldExplode = (cell.count + 1) >= cap;
  if (wouldExplode) {
    score += 150;
    const capturedNeighbors = neighbors.filter(([nr, nc]) => {
      const n = getCell(nr, nc);
      return n.owner !== null && n.owner !== me;
    }).length;
    score += capturedNeighbors * 60;
  }

  for (const [nr, nc] of neighbors) {
    const n = getCell(nr, nc);
    const nCap = getCapacity(nr, nc);
    if (n.owner !== null && n.owner !== me && n.count === nCap - 1) score += wouldExplode ? 80 : 25;
    if (n.owner === me && n.count === nCap - 1) score += 40;
  }
  for (const [nr, nc] of neighbors) {
    const n = getCell(nr, nc);
    const nCap = getCapacity(nr, nc);
    if (n.owner !== null && n.owner !== me && n.count >= nCap - 1) score -= 30 + (4 - nCap) * 10;
  }

  const centerR = Math.floor(ROWS / 2);
  const centerC = Math.floor(COLS / 2);
  score -= (Math.abs(r - centerR) + Math.abs(c - centerC)) * 0.15;
  score += Math.random() * 2;
  return score;
}

function minimax(r, c, depth, alpha, beta, isMaximizing, deadline = Infinity) {
  NODE_COUNT++;
  const me = currentPlayerIndex;
  const boardCopy = cloneState();
  applyMove(boardCopy, r, c, me);

  if (performance.now() > deadline) return evaluate(boardCopy);
  const winner = getWinnerFromBoard(boardCopy);
  if (winner !== null) return winner === me ? 100000 : -100000;
  if (depth === 0) return evaluate(boardCopy);

  const nextPlayer = (me + 1) % numPlayers;
  let moves = getValidMovesFrom(boardCopy, nextPlayer);
  if (moves.length === 0) return evaluate(boardCopy);

  const scoredSorted = moves
    .map(m => ({ m, s: scoreMoveFor(m.row, m.col, nextPlayer) }))
    .sort((a, b) => (isMaximizing ? b.s - a.s : a.s - b.s));
  const cappedMoves = capChildMoves(scoredSorted, boardCopy, 8);

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const m of cappedMoves) {
      const value = minimaxSim(boardCopy, m.row, m.col, depth - 1, alpha, beta, false, nextPlayer, deadline);
      maxEval = Math.max(maxEval, value); alpha = Math.max(alpha, value);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const m of cappedMoves) {
      const value = minimaxSim(boardCopy, m.row, m.col, depth - 1, alpha, beta, true, nextPlayer, deadline);
      minEval = Math.min(minEval, value); beta = Math.min(beta, value);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

function minimaxSim(srcBoard, r, c, depth, alpha, beta, isMax, playerId, deadline = Infinity) {
  NODE_COUNT++;
  const boardCopy = srcBoard.map(row => row.map(cell => ({ ...cell })));
  applyMove(boardCopy, r, c, playerId);

  const me = currentPlayerIndex;
  if (performance.now() > deadline) return evaluate(boardCopy);
  const winner = getWinnerFromBoard(boardCopy);
  if (winner !== null) return winner === me ? 100000 : -100000;
  if (depth === 0) return evaluate(boardCopy);

  const nextPlayer = (playerId + 1) % numPlayers;
  let moves = getValidMovesFrom(boardCopy, nextPlayer);
  if (moves.length === 0) return evaluate(boardCopy);

  const scoredSorted = moves
    .map(m => ({ m, s: scoreMoveFor(m.row, m.col, nextPlayer) }))
    .sort((a, b) => (isMax ? b.s - a.s : a.s - b.s));
  const cappedMoves = capChildMoves(scoredSorted, boardCopy, 8);

  if (isMax) {
    let maxEval = -Infinity;
    for (const m of cappedMoves) {
      const value = minimaxSim(boardCopy, m.row, m.col, depth - 1, alpha, beta, false, nextPlayer, deadline);
      maxEval = Math.max(maxEval, value); alpha = Math.max(alpha, value);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const m of cappedMoves) {
      const value = minimaxSim(boardCopy, m.row, m.col, depth - 1, alpha, beta, true, nextPlayer, deadline);
      minEval = Math.min(minEval, value); beta = Math.min(beta, value);
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
      if (cell.owner === null || cell.owner === playerId) moves.push({ row: r, col: c });
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
      if (cell.owner !== null) ownersPresent.add(cell.owner);
    }
  }
  if (ownersPresent.size === 1 && hasMoved.filter(Boolean).length >= numPlayers) return [...ownersPresent][0];
  return null;
}
