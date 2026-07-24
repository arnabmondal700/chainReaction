// tutorial.js — Scripted "watch it happen" gameplay walkthrough.
//
// Design: reuses the REAL board state and the REAL renderer/animation
// pipeline (rules.js + render.js), so what the player sees here is
// pixel-identical to actual play. It does NOT touch turn order, win
// checks, or stats — those stay fully isolated from the demo. When the
// tutorial ends (finished or skipped), the caller resets to a real,
// clean game via the onFinish callback.

'use strict';

import { WAVE_DELAY, PLACE_DELAY } from './constants.js';
import {
  board, players,
  markDirty, setBusy,
} from './state.js';
import { collectOverflowing, explodeCell } from './rules.js';
import { renderDirty, triggerShockwave, triggerJump, triggerImpact } from './render.js';
import * as Sound from './sound.js';

const CAPTION_BEAT_DELAY = 900; // pause between narrated beats within a step

let barEl, captionEl, dotsEl, nextBtn, skipBtn, readRulesLink;

let resolveNext = null;
let active = false;
let onFinishCb = null;

function q(r, c) {
  return document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
}

function clearHighlights() {
  document.querySelectorAll('.tutorial-highlight').forEach(el => {
    el.classList.remove('tutorial-highlight');
  });
}

function applyHighlight(cells = []) {
  clearHighlights();
  cells.forEach(([r, c]) => {
    const el = q(r, c);
    if (el) el.classList.add('tutorial-highlight');
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function setCaption(html) {
  captionEl.innerHTML = html;
}

function setDots(index, total) {
  dotsEl.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const dot = document.createElement('span');
    dot.className = 'tutorial-dot' + (i === index ? ' active' : '');
    dotsEl.appendChild(dot);
  }
}

// ---- Demo board helpers (mirror the real handleCellClick/resolveExplosions,
// but skip turn advancement, win checks, and stats — those stay real-game-only) ----

function placeDemoOrb(r, c, ownerId) {
  const cell = board[r][c];
  cell.count += 1;
  cell.owner = ownerId;
  markDirty(r, c);
  Sound.play('place');
  renderDirty();
}

function setupCellSilently(r, c, ownerId, count) {
  const cell = board[r][c];
  cell.owner = ownerId;
  cell.count = count;
  markDirty(r, c);
}

async function resolveDemoCascade(onWave) {
  let overflowing = collectOverflowing();
  let cascadeTotal = 0;
  while (overflowing.length > 0) {
    if (!active) return;
    cascadeTotal += overflowing.length;
    if (onWave) await onWave(cascadeTotal, overflowing.length);
    if (!active) return;
    overflowing.forEach(([r, c]) => {
      const color = players[board[r][c].owner].color;
      const affected = explodeCell(r, c);
      affected.forEach(([ar, ac]) => markDirty(ar, ac));
      triggerShockwave(r, c, color, cascadeTotal);
      triggerJump(r, c);
      affected.slice(1).forEach(([ar, ac]) => triggerImpact(ar, ac, color));
    });
    Sound.playExplosionBurst(overflowing.length, cascadeTotal);
    renderDirty();
    await sleep(WAVE_DELAY);
    if (!active) return;
    overflowing = collectOverflowing();
  }
}

// ---- The script ----

const STEPS = [
  {
    caption: 'Tap any empty cell — or one you already own — to place an orb. Let\u2019s try it.',
    highlight: [[4, 2]],
    run: async () => {
      await sleep(300);
      if (!active) return;
      placeDemoOrb(4, 2, 0);
    },
  },
  {
    caption: 'Every cell can only hold so many orbs before it\u2019s full: 2 in a corner, 3 on an edge, 4 in the center. This one holds 4 \u2014 let\u2019s fill it up.',
    highlight: [[4, 2]],
    run: async () => {
      await sleep(250);
      if (!active) return;
      placeDemoOrb(4, 2, 0);
      await sleep(PLACE_DELAY + 250);
      if (!active) return;
      placeDemoOrb(4, 2, 0);
    },
  },
  {
    caption: 'One more orb is too many \u2014 the cell explodes, firing one orb into every neighboring cell!',
    highlight: [[4, 2], [3, 2], [5, 2], [4, 1], [4, 3]],
    run: async () => {
      // Plant an opponent cell next door, already one orb from exploding
      // itself \u2014 sets up the chain-reaction beat below.
      setupCellSilently(4, 3, 1, 3);
      renderDirty();
      await sleep(500);
      if (!active) return;
      placeDemoOrb(4, 2, 0);
      await sleep(PLACE_DELAY);
      if (!active) return;
      await resolveDemoCascade(async (cascadeTotal, waveSize) => {
        if (cascadeTotal === waveSize) {
          // first wave — no caption change needed, the explosion IS the point
          return;
        }
        // a later wave means a captured cell was already critical
        setCaption('Watch closely \u2014 that neighbor was ALSO nearly full. Capturing it just set off a second explosion. This is a <strong>chain reaction</strong>: one move can cascade across the whole board.');
        await sleep(CAPTION_BEAT_DELAY);
      });
    },
  },
  {
    caption: 'Capture every cell on the board and you win the game.',
    highlight: [],
    run: async () => { await sleep(200); },
  },
  {
    caption: 'Ready to play for real? Pick <strong>Player vs CPU</strong> or <strong>Player vs Player</strong> up top, or just hit Start below.',
    highlight: [],
    run: async () => { await sleep(200); },
    isFinal: true,
  },
];

function waitForNext() {
  return new Promise(resolve => { resolveNext = resolve; });
}

async function playStep(i) {
  const step = STEPS[i];
  setDots(i, STEPS.length);
  setCaption(step.caption);
  applyHighlight(step.highlight);
  nextBtn.textContent = step.isFinal ? 'Start Playing' : 'Next';
  nextBtn.disabled = true; // don't allow advancing mid-animation — avoids
                            // two steps' scripted actions overlapping
  if (step.run) await step.run();
  if (!active) return;
  nextBtn.disabled = false;
}

async function runSteps() {
  for (let i = 0; i < STEPS.length; i++) {
    if (!active) return;
    await playStep(i);
    if (!active) return;
    await waitForNext();
  }
  finish();
}

function finish() {
  if (!active) return;
  active = false;
  clearHighlights();
  barEl.classList.add('hidden');
  document.body.classList.remove('tutorial-active');
  if (onFinishCb) onFinishCb();
}

/**
 * Start the interactive demo. `onFinish` is called once, when the demo
 * ends (naturally or via Skip) — the caller is responsible for resetting
 * to a real, playable game.
 */
export function startTutorial({ onFinish } = {}) {
  if (active) return;
  onFinishCb = onFinish || null;
  active = true;

  if (!barEl) cacheTutorialDom();

  setBusy(true); // reuses the same guard handleCellClick already checks
  document.body.classList.add('tutorial-active');
  barEl.classList.remove('hidden');

  runSteps();
}

function cacheTutorialDom() {
  barEl = document.getElementById('tutorialBar');
  captionEl = document.getElementById('tutorialCaption');
  dotsEl = document.getElementById('tutorialDots');
  nextBtn = document.getElementById('tutorialNextBtn');
  skipBtn = document.getElementById('tutorialSkipBtn');
  readRulesLink = document.getElementById('tutorialReadRulesLink');

  nextBtn.addEventListener('click', () => {
    if (nextBtn.disabled) return;
    Sound.unlock();
    Sound.play('click');
    if (resolveNext) {
      const r = resolveNext;
      resolveNext = null;
      r();
    }
  });

  skipBtn.addEventListener('click', () => {
    Sound.unlock();
    Sound.play('click');
    finish();
  });

  readRulesLink.addEventListener('click', (e) => {
    e.preventDefault();
    Sound.unlock();
    finish();
    document.getElementById('rulesOverlay')?.classList.remove('hidden');
  });

  document.addEventListener('keydown', (e) => {
    if (!active) return;
    if (e.key === 'Escape') finish();
  });
}
