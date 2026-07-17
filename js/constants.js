// constants.js — Game constants and configuration

'use strict';

export const ROWS = 9;
export const COLS = 6;

export const PLAYER_DEFS = [
  { name: 'Ember',  color: '#ff5a5f' },
  { name: 'Ion',    color: '#2fe0ff' },
  { name: 'Volt',   color: '#ffd23f' },
  { name: 'Plasma', color: '#b168ff' },
];

// Animation timings (milliseconds)
export const WAVE_DELAY = 260;
export const PLACE_DELAY = 90;

// CSS class names used by render logic
export const CLASSES = {
  cell: 'cell',
  disabled: 'disabled',
  primed: 'primed',
  exploding: 'exploding',
  jumping: 'jumping',
  orbs: 'orbs',
  orb: 'orb',
  playerChip: 'player-chip',
  active: 'active',
  eliminated: 'eliminated',
  hidden: 'hidden',
};
