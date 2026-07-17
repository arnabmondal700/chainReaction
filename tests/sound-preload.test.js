const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

test('main.js starts sound preloading early', () => {
  const mainSource = read('js/main.js');
  assert.match(mainSource, /import \* as Sound from '\.\/sound\.js'/);
  assert.match(mainSource, /Sound\.preload\(\);/);
});

test('build.js exposes preload in the bundled Sound object', () => {
  const buildSource = read('build.js');
  assert.match(buildSource, /window\.Sound = \{ unlock, play, isMuted, setMuted, toggleMute, playExplosionBurst, preload \};/);
});
