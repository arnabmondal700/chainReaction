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

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');

// Ordered module dependency chain (must be in dependency order)
const JS_MODULES = [
  'constants.js',
  'state.js',
  'rules.js',
  'render.js',
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
  return code
    .replace(/^import\s+[\s\S]*?from\s+['"][^'"]*['"]\s*;?\s*$/gm, '')
    .replace(/^export\s+/gm, '')
    .trim();
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
function build() {
  // Ensure dist/ exists
  if (!fs.existsSync(DIST)) {
    fs.mkdirSync(DIST, { recursive: true });
  }

  // Read the source index.html
  let html = read(path.join(ROOT, 'index.html'));

  // Inline CSS: find <link rel="stylesheet" href="css/styles.css" />
  // and replace with <style>...</style>
  const cssContent = read(path.join(ROOT, 'css', 'styles.css'));
  html = html.replace(
    /<link rel="stylesheet" href="css\/styles.css"\s*\/?>/,
    () => `<style>${cssContent}</style>`
  );

  // Inline JS: find <script type="module" src="js/main.js"></script>
  // and replace with concatenated IIFE-wrapped script
  const moduleSources = JS_MODULES.map((mod) => {
    const fullPath = path.join(ROOT, 'js', mod);
    const code = read(fullPath);
    return stripModuleSyntax(code);
  });

  const combinedJS = moduleSources.join('\n\n');
  const wrappedJS = wrapIIFE(combinedJS);

  html = html.replace(
    /<script type="module" src="js\/main\.js"><\/script>/,
    () => `<script>${wrappedJS}</script>`
  );

  // Write dist/index.html
  const outPath = path.join(DIST, 'index.html');
  fs.writeFileSync(outPath, html, 'utf-8');

  console.log(`✓ Built ${outPath}  (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB)`);
}

build();
