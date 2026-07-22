// sound.js — Web Audio–based sound effect manager
'use strict';

const MANIFEST = {
  place:   'audio/place.mp3',
  explode: 'audio/explode.mp3',
  win:     'audio/win.mp3',
  invalid: 'audio/invalid.mp3',
  click:   'audio/click.mp3',
};

const MUTE_STORAGE_KEY = 'chainReaction:muted';

let audioCtx = null;
let masterGain = null;
const buffers = new Map();   // name -> AudioBuffer
let loaded = false;
let loadPromise = null;
let muted = readStoredMute();

function readStoredMute() {
  try {
    return localStorage.getItem(MUTE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeStoredMute(val) {
  try {
    localStorage.setItem(MUTE_STORAGE_KEY, val ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function ensureContext() {
  if (audioCtx) return audioCtx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) {
    console.warn('sound.js: AudioContext unavailable in this browser');
    return null;
  }
  audioCtx = new Ctx();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = muted ? 0 : 1;
  masterGain.connect(audioCtx.destination);
  console.info('sound.js: AudioContext created, muted=', muted);
  return audioCtx;
}

// iOS suspends the AudioContext when the app is backgrounded/interrupted and
// won't auto-resume it — only a fresh user gesture can. visibilitychange is
// NOT sufficient (WebKit blocks playback until a direct interaction occurs).
document.addEventListener('touchend', () => {
  if (audioCtx && audioCtx.state !== 'running') {
    audioCtx.resume().catch(() => {});
  }
});

function loadArrayBuffer(url) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = () => resolve(xhr.response);
    xhr.onerror = () => reject(new Error(`XHR error loading ${url}`));
    xhr.send();
  });
}

function ensureLoading() {
  const ctx = ensureContext();
  if (!ctx) return null;
  if (!loadPromise) {
    loaded = true;
    loadPromise = loadAll(ctx);
  }
  return loadPromise;
}

export function preload() {
  return ensureLoading();
}

export function unlock() {
  const ctx = ensureContext();
  if (!ctx) return;
  console.info('sound.js: AudioContext state before unlock=', ctx.state);
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  ensureLoading();
}

async function loadAll(ctx) {
  await Promise.all(
    Object.entries(MANIFEST).map(async ([name, url]) => {
      try {
        let arrayBuffer = null;
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
          arrayBuffer = await res.arrayBuffer();
        } catch (fetchErr) {
          console.warn(`sound.js: fetch failed for "${name}" (${fetchErr.message}); trying XHR fallback`);
          arrayBuffer = await loadArrayBuffer(url);
        }
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        buffers.set(name, audioBuffer);
        console.info(`sound.js: loaded "${name}"`);
      } catch (err) {
        console.warn(`sound.js: failed to load "${name}" from ${url}`, err);
      }
    })
  );
  console.info('sound.js: buffers loaded=', [...buffers.keys()]);
  // If we loaded successfully but mute state was on, ensure playback remains muted.
  // If muted was persisted as on but user hasn't interacted with mute UI yet,
  // keep as-is; do not override stored preference.
}

export function play(name, opts = {}) {
  if (!audioCtx) {
    console.warn('sound.js: play() skipped, AudioContext missing');
    return;
  }
  if (!buffers.has(name)) {
    console.warn(`sound.js: play() skipped, buffer missing: "${name}"`);
    return;
  }
  const { volume = 1, rate = 1 } = opts;

  const source = audioCtx.createBufferSource();
  source.buffer = buffers.get(name);
  source.playbackRate.value = rate;

  const gain = audioCtx.createGain();
  gain.gain.value = volume;

  source.connect(gain);
  gain.connect(masterGain);
  source.start(0);
}

export function isMuted() {
  return muted;
}

export function setMuted(val) {
  muted = val;
  writeStoredMute(muted);
  if (masterGain && audioCtx) {
    const now = audioCtx.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(masterGain.gain.value, now);
    masterGain.gain.linearRampToValueAtTime(muted ? 0 : 1, now + 0.05);
  }
}

export function toggleMute() {
  setMuted(!muted);
  return muted;
}

const MAX_LAYERED_EXPLOSIONS = 6;

/**
 * Play layered explosion sounds for a cascade wave.
 * @param {number} waveCount — number of cells exploding in this wave
 * @param {number} [cascadeTotal=0] — cumulative cells exploded across the full cascade
 */
export function playExplosionBurst(waveCount, cascadeTotal = 0) {
  const layers = Math.min(waveCount, MAX_LAYERED_EXPLOSIONS);
  const intensity = Math.min(1, cascadeTotal / 12);
  for (let i = 0; i < layers; i++) {
    const jitter = 0.88 + Math.random() * 0.2 + intensity * 0.15;
    const falloff = 1 - i * 0.10;
    const volBoost = 1 + intensity * 0.3;
    play('explode', { rate: jitter, volume: Math.max(0.3, Math.min(1, falloff * volBoost)) });
  }
}
