// tests/dist-build.smoke.mjs — confirms the actual SHIPPED dist/index.html
// (the bundled, build.js output — not the source modules) boots without
// error and the tutorial launches there too. This catches bundling-only
// bugs (e.g. duplicate `let`/`const` declarations across concatenated
// modules) that source-level tests can't see, since dev-mode ES modules
// have real per-file scoping and never hit this class of bug at all.
//
// Requires a build to exist first: run `npm run build` (or build:min).
//   node tests/dist-build.smoke.mjs

import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const distPath = path.join(root, 'dist', 'index.html');

async function main() {
  assert.ok(fs.existsSync(distPath), 'dist/index.html not found — run `npm run build` first');
  const html = fs.readFileSync(distPath, 'utf8');

  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true });
  await new Promise(r => setTimeout(r, 200));

  const doc = dom.window.document;
  const board = doc.getElementById('board');
  assert.equal(board.children.length, 54, 'Bundled build should render a 9x6 (54-cell) board — the app likely failed to boot (check for a bundling-time syntax error)');

  const gameMode = doc.getElementById('gameMode');
  assert.equal(gameMode.value, 'cpu', 'Bundled build default mode should be "cpu"');

  const howToPlayBtn = doc.getElementById('howToPlayBtn');
  howToPlayBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 100));

  const bar = doc.getElementById('tutorialBar');
  assert.ok(!bar.classList.contains('hidden'), 'Tutorial bar should appear on the bundled build too');
  assert.ok(doc.getElementById('tutorialCaption').textContent.length > 0, 'Tutorial caption should have content');

  console.log('dist-build.smoke.mjs — all assertions passed');
}

main().catch(err => {
  console.error('dist-build.smoke.mjs FAILED:', err.message);
  process.exit(1);
});
