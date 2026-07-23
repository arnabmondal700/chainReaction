// tests/tutorial.smoke.mjs — end-to-end smoke test for the interactive
// "How to Play" tutorial, run against the real DOM (via jsdom) and the
// real app modules (not mocks). Run directly with:
//   node tests/tutorial.smoke.mjs
// Not wired into `node --test` since it's a full integration script with
// real timers, not an isolated unit test — but it asserts (not just logs),
// so it exits non-zero and prints a clear failure if anything regresses.

import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const dom = new JSDOM(html, { url: 'http://localhost/', pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
globalThis.CustomEvent = dom.window.CustomEvent;
globalThis.HTMLElement = dom.window.HTMLElement;
// Intentionally NOT providing AudioContext — sound.js degrades to a safe
// no-op everywhere when it's unavailable, which is correct here since this
// test is about tutorial control flow, not audio.

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function click(el) { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); }

async function boardSnapshot() {
  const state = await import(path.join(root, 'js', 'state.js'));
  const rows = [];
  for (let r = 0; r < 9; r++) {
    let row = '';
    for (let c = 0; c < 6; c++) {
      const cell = state.board[r][c];
      row += (cell.owner === null ? '.' : cell.owner) + String(cell.count) + ' ';
    }
    rows.push(row);
  }
  return rows.join('\n');
}

function isEmptyBoard(snapshot) {
  return snapshot.split('\n').every(row => /^(\.0 )*\.0 ?$/.test(row.trim() + ' '));
}

async function main() {
  await import(path.join(root, 'js', 'main.js'));

  const gameModeEl = document.getElementById('gameMode');
  assert.equal(gameModeEl.value, 'cpu', 'Default game mode should be "cpu", not "pvp"');

  const howToPlayBtn = document.getElementById('howToPlayBtn');
  const tutorialBar = document.getElementById('tutorialBar');
  const rulesOverlay = document.getElementById('rulesOverlay');
  const caption = document.getElementById('tutorialCaption');
  const nextBtn = document.getElementById('tutorialNextBtn');
  const skipBtn = document.getElementById('tutorialSkipBtn');

  // --- Run 1: click through the whole tutorial normally ---
  click(howToPlayBtn);
  await sleep(50);
  assert.ok(!tutorialBar.classList.contains('hidden'), 'Tutorial bar should be visible after clicking How to Play');
  assert.ok(document.body.classList.contains('tutorial-active'), 'body.tutorial-active should be set while the tutorial runs');
  assert.ok(rulesOverlay.classList.contains('hidden'), 'The static rules modal should NOT open — the tutorial replaces it');

  let steps = 0;
  const MAX_STEPS = 10; // real tutorial has 5 — this is just a hang-safety cap
  let finished = false;
  while (steps < MAX_STEPS) {
    steps++;
    let waited = 0;
    while (nextBtn.disabled && waited < 5000) { await sleep(50); waited += 50; }
    assert.ok(!nextBtn.disabled, `Step ${steps} ("${caption.textContent.slice(0, 40)}...") never finished animating within 5s`);

    if (nextBtn.textContent === 'Start Playing') {
      const midSnapshot = await boardSnapshot();
      assert.match(midSnapshot, /01/, 'Expected demo board to show captured cells before finishing');
      click(nextBtn);
      finished = true;
      break;
    }
    click(nextBtn);
    await sleep(20);
  }
  assert.ok(finished, `Tutorial did not reach its final step within ${MAX_STEPS} step iterations`);

  await sleep(100);
  assert.ok(tutorialBar.classList.contains('hidden'), 'Tutorial bar should hide again after finishing');
  assert.ok(!document.body.classList.contains('tutorial-active'), 'body.tutorial-active should be removed after finishing');
  const resetSnapshot = await boardSnapshot();
  assert.ok(isEmptyBoard(resetSnapshot), 'Board should be reset to empty for real play after the tutorial finishes');

  // --- Run 2: Skip mid-animation must not leak mutations into the fresh game ---
  click(howToPlayBtn);
  await sleep(50);
  click(nextBtn); // finish step 1
  await sleep(600);
  click(nextBtn); // finish step 2, enter step 3 (the multi-wave cascade)
  await sleep(300); // step 3 should still be mid-flight here
  assert.ok(nextBtn.disabled, 'Next should still be disabled mid-cascade — sanity check for the assertion below');

  click(skipBtn);
  await sleep(50);
  const rightAfterSkip = await boardSnapshot();
  assert.ok(isEmptyBoard(rightAfterSkip), 'Board should be immediately clean after a mid-animation Skip');

  await sleep(2000); // give any orphaned setTimeout chains a chance to fire
  const afterWaiting = await boardSnapshot();
  assert.equal(afterWaiting, rightAfterSkip, 'Aborted cascade must not leak mutations into the board after Skip');

  console.log('tutorial.smoke.mjs — all assertions passed');
}

main().catch(err => {
  console.error('tutorial.smoke.mjs FAILED:', err.message);
  process.exit(1);
});
