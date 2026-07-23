/**
 * build.js — Chain Reaction Build Script
 *
 * Concatenates the modular source files into a single self-contained
 * dist/index.html (CSS inlined, JS concatenated and wrapped in an IIFE).
 *
 * Usage: node build.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { minify: minifyJS } = require('terser');
const CleanCSS = require('clean-css');
const { minify: minifyHTML } = require('html-minifier-terser');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');

// Pass --minify (or `npm run build:min`) to produce a minified dist/index.html.
// Plain `node build.js` still produces the original, readable bundle.
const SHOULD_MINIFY = process.argv.includes('--minify');

// Ordered module dependency chain (must be in dependency order)
const JS_MODULES = [
  'constants.js',
  'state.js',
  'rules.js',
  'render.js',
  'sound.js',
  'tutorial.js',
  'ui.js',
  'cpu.js',
  'main.js',
];

/**
 * Read a file as UTF-8 text.
 */
function read(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Strip import/export statements from a JS module so it can be safely
 * concatenated into a single IIFE.
 */
function stripModuleSyntax(code) {
  // Replace the sound.js namespace import with a reference to the shared global.
  // Using var allows multiple concatenated modules to share the same binding.
  code = code.replace(/^import\s+\*\s+as\s+Sound\s+from\s+['"]\.\/sound\.js['"]\s*;?\s*$/gm, 'var Sound = window.Sound;');
  // Strip remaining imports
  code = code.replace(/^import\s+[\s\S]*?from\s+['"][^'"]*['"]\s*;?\s*$/gm, '');
  code = code.replace(/^export\s+/gm, '');
  return code.trim();
}

/**
 * Wrap JS source in an IIFE that provides a shared scope for all modules.
 */
function wrapIIFE(code) {
  return `(function(){\n'use strict';\n\n${code}\n\n})();`;
}

/**
 * Build the production index.html.
 */
async function build() {
  // Ensure dist/ exists
  if (!fs.existsSync(DIST)) {
    fs.mkdirSync(DIST, { recursive: true });
  }

  // Read the source index.html
  let html = read(path.join(ROOT, 'index.html'));

  // Inline CSS: find <link rel="stylesheet" href="css/styles.css" />
  // and replace with <style>...</style>
  let cssContent = read(path.join(ROOT, 'css', 'styles.css'));

  // Inline JS: find <script type="module" src="js/main.js"></script>
  // and replace with concatenated IIFE-wrapped script
  const moduleSources = [];
  for (const mod of JS_MODULES) {
    const fullPath = path.join(ROOT, 'js', mod);
    let code = read(fullPath);
    code = stripModuleSyntax(code);
    if (mod === 'sound.js') {
      code += '\n\nwindow.Sound = { unlock, play, isMuted, setMuted, toggleMute, playExplosionBurst, preload };';
    }
    moduleSources.push(code);
  }

  const combinedJS = moduleSources.join('\n\n');
  let wrappedJS = wrapIIFE(combinedJS);

  if (SHOULD_MINIFY) {
    // Minify JS with Terser (safe: parses a real AST, so template literals,
    // strings containing "//" or "/* */", regex literals, etc. are handled
    // correctly instead of being mangled by naive regex stripping).
    const jsResult = await minifyJS(wrappedJS, {
      compress: true,
      mangle: true,
      format: { comments: false },
    });
    if (jsResult.error) throw jsResult.error;
    wrappedJS = jsResult.code;

    // Minify CSS with clean-css.
    const cssResult = new CleanCSS({ level: 2 }).minify(cssContent);
    if (cssResult.errors.length) throw new Error(cssResult.errors.join('\n'));
    cssContent = cssResult.styles;
  }

  html = html.replace(
    /<link rel="stylesheet" href="css\/styles.css"\s*\/?>/,
    () => `<style>${cssContent}</style>`
  );

  html = html.replace(
    /<script type="module" src="js\/main\.js"><\/script>/,
    () => `<script>${wrappedJS}</script>`
  );

  if (SHOULD_MINIFY) {
    // Minify the HTML shell itself (whitespace, attribute quotes, etc.).
    // collapseWhitespace/minify* options are all safe/conservative here —
    // none of them touch the already-minified <style>/<script> contents
    // beyond what we did above (minifyCSS/minifyJS below are turned off
    // since we pre-minified with dedicated tools that understand this
    // codebase's syntax better than html-minifier-terser's generic ones).
    html = await minifyHTML(html, {
      collapseWhitespace: true,
      conservativeCollapse: false,
      removeComments: true,
      removeRedundantAttributes: true,
      removeEmptyAttributes: true,
      useShortDoctype: true,
      minifyCSS: false,
      minifyJS: false,
    });
  }

  // Copy static audio assets to dist/
  const AUDIO_SRC = path.join(ROOT, 'audio');
  const AUDIO_DEST = path.join(DIST, 'audio');
  if (fs.existsSync(AUDIO_SRC)) {
    fs.cpSync(AUDIO_SRC, AUDIO_DEST, { recursive: true });
  }

  // Write dist/index.html
  const outPath = path.join(DIST, 'index.html');
  fs.writeFileSync(outPath, html, 'utf-8');

  const label = SHOULD_MINIFY ? 'Built (minified)' : 'Built';
  console.log(`✓ ${label} ${outPath}  (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB)`);
}

build().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});