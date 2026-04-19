/**
 * Replaces CDN references in HTML files with local /vendor/ paths.
 * Usage: bun run scripts/patch-cdn-to-vendor.ts
 */

import { readdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

const PUBLIC = path.resolve(import.meta.dir, "..", "public");

// ── Replacement patterns ───────────────────────────────────────────

type Replacement = [search: string | RegExp, replace: string];

const replacements: Replacement[] = [
  // ── Google Fonts preconnect lines (remove entirely) ──
  [/\s*<link\s+rel="preconnect"\s+href="https:\/\/fonts\.googleapis\.com"\s*\/?>\s*\n/g, "\n"],
  [/\s*<link\s+rel="preconnect"\s+href="https:\/\/fonts\.gstatic\.com"\s+crossorigin\s*\/?>\s*\n/g, ""],

  // ── Google Fonts Inter 400;600;700 → local fontsource ──
  [
    /\s*<link\s*\n?\s*href="https:\/\/fonts\.googleapis\.com\/css2\?family=Inter:wght@400;600;700&display=swap"\s*\n?\s*rel="stylesheet"\s*\n?\s*\/?\s*>\s*\n?/g,
    `\n    <link rel="stylesheet" href="/vendor/inter/400.css" />\n    <link rel="stylesheet" href="/vendor/inter/600.css" />\n    <link rel="stylesheet" href="/vendor/inter/700.css" />\n`,
  ],

  // ── Google Fonts Inter 400;500;600;700 (Desktop variant) ──
  [
    /<link\s+href="https:\/\/fonts\.googleapis\.com\/css2\?family=Inter:wght@400;500;600;700&display=swap"\s+rel="stylesheet"\s*\/?>/g,
    `<link rel="stylesheet" href="/vendor/inter/400.css" />\n  <link rel="stylesheet" href="/vendor/inter/600.css" />\n  <link rel="stylesheet" href="/vendor/inter/700.css" />`,
  ],

  // ── Google Fonts Inter + JetBrains Mono (console.html) ──
  [
    /\s*<link\s*\n?\s*href="https:\/\/fonts\.googleapis\.com\/css2\?family=Inter:wght@400;600;700&family=JetBrains\+Mono:wght@400;600&display=swap"\s*\n?\s*rel="stylesheet"\s*\n?\s*\/?\s*>\s*\n?/g,
    `\n    <link rel="stylesheet" href="/vendor/inter/400.css" />\n    <link rel="stylesheet" href="/vendor/inter/600.css" />\n    <link rel="stylesheet" href="/vendor/inter/700.css" />\n    <link rel="stylesheet" href="/vendor/jetbrains-mono/400.css" />\n    <link rel="stylesheet" href="/vendor/jetbrains-mono/600.css" />\n`,
  ],

  // ── Font Awesome CSS ──
  [
    /\s*<link\s*\n?\s*rel="stylesheet"\s*\n?\s*href="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome\/6\.5\.2\/css\/all\.min\.css"\s*\n?\s*crossorigin="anonymous"\s*\n?\s*referrerpolicy="no-referrer"\s*\n?\s*\/?\s*>/g,
    `\n    <link rel="stylesheet" href="/vendor/fontawesome/css/all.min.css" />`,
  ],
  // Single-line variant (Desktop)
  [
    /<link\s+rel="stylesheet"\s+href="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome\/6\.5\.2\/css\/all\.min\.css"\s*\n?\s*crossorigin="anonymous"\s+referrerpolicy="no-referrer"\s*\/?>/g,
    `<link rel="stylesheet" href="/vendor/fontawesome/css/all.min.css" />`,
  ],

  // ── Flag Icons CSS ──
  [
    /\s*<link\s*\n?\s*rel="stylesheet"\s*\n?\s*href="https:\/\/cdn\.jsdelivr\.net\/npm\/flag-icons@6\.15\.0\/css\/flag-icons\.min\.css"\s*\n?\s*crossorigin="anonymous"\s*\n?\s*referrerpolicy="no-referrer"\s*\n?\s*\/?\s*>/g,
    `\n    <link rel="stylesheet" href="/vendor/flag-icons/css/flag-icons.min.css" />`,
  ],

  // ── anime.js ──
  [
    /\s*<script\s*\n?\s*src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/animejs\/3\.2\.2\/anime\.min\.js"\s*\n?\s*crossorigin="anonymous"\s*\n?\s*referrerpolicy="no-referrer"\s*\n?\s*><\/script>/g,
    `\n    <script src="/vendor/animejs/anime.min.js"></script>`,
  ],

  // ── msgpackr ──
  [
    /<script\s+(?:defer\s+)?src="https:\/\/cdn\.jsdelivr\.net\/npm\/msgpackr@1\.11\.8\/dist\/index\.js"><\/script>/g,
    `<script defer src="/vendor/msgpackr/msgpackr.js"></script>`,
  ],

  // ── highlight.js CSS ──
  [
    /\s*<link\s*\n?\s*rel="stylesheet"\s*\n?\s*href="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/highlight\.js\/11\.9\.0\/styles\/atom-one-dark\.min\.css"\s*\n?\s*\/?\s*>/g,
    `\n    <link rel="stylesheet" href="/vendor/highlight.js/atom-one-dark.min.css" />`,
  ],

  // ── highlight.js core + all language scripts → single bundle ──
  [
    /<script\s+src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/highlight\.js\/11\.9\.0\/highlight\.min\.js"><\/script>\s*(?:<script\s+src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/highlight\.js\/11\.9\.0\/languages\/\w+\.min\.js"><\/script>\s*)*/g,
    `<script src="/vendor/highlight.js/highlight.bundle.js"></script>`,
  ],

  // ── CodeMirror CSS ──
  [
    /\s*<link\s*\n?\s*rel="stylesheet"\s*\n?\s*href="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/codemirror\/5\.65\.16\/codemirror\.min\.css"\s*\n?\s*\/?\s*>/g,
    `\n    <link rel="stylesheet" href="/vendor/codemirror/lib/codemirror.css" />`,
  ],
  [
    /\s*<link\s*\n?\s*rel="stylesheet"\s*\n?\s*href="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/codemirror\/5\.65\.16\/theme\/material-darker\.min\.css"\s*\n?\s*\/?\s*>/g,
    `\n    <link rel="stylesheet" href="/vendor/codemirror/theme/material-darker.css" />`,
  ],

  // ── CodeMirror JS ──
  [
    /<script\s+src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/codemirror\/5\.65\.16\/codemirror\.min\.js"><\/script>/g,
    `<script src="/vendor/codemirror/lib/codemirror.js"></script>`,
  ],
  [
    /<script\s+src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/codemirror\/5\.65\.16\/mode\/powershell\/powershell\.min\.js"><\/script>/g,
    `<script src="/vendor/codemirror/mode/powershell/powershell.js"></script>`,
  ],
  [
    /<script\s+src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/codemirror\/5\.65\.16\/mode\/shell\/shell\.min\.js"><\/script>/g,
    `<script src="/vendor/codemirror/mode/shell/shell.js"></script>`,
  ],
  [
    /<script\s+src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/codemirror\/5\.65\.16\/mode\/python\/python\.min\.js"><\/script>/g,
    `<script src="/vendor/codemirror/mode/python/python.js"></script>`,
  ],

  // ── Ace Editor ──
  [
    /<script\s+src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/ace\/1\.36\.5\/ace\.js"><\/script>/g,
    `<script src="/vendor/ace-builds/ace.js"></script>`,
  ],

  // ── Chart.js ──
  [
    /<script\s+src="https:\/\/cdn\.jsdelivr\.net\/npm\/chart\.js@4\.4\.0\/dist\/chart\.umd\.min\.js"><\/script>/g,
    `<script src="/vendor/chart.js/chart.umd.js"></script>`,
  ],

  // ── Leaflet CSS ──
  [
    /\s*<link\s*\n?\s*rel="stylesheet"\s*\n?\s*href="https:\/\/cdn\.jsdelivr\.net\/npm\/leaflet@1\.9\.4\/dist\/leaflet\.css"\s*\n?\s*\/?\s*>/g,
    `\n    <link rel="stylesheet" href="/vendor/leaflet/leaflet.css" />`,
  ],

  // ── Leaflet JS ──
  [
    /<script\s+src="https:\/\/cdn\.jsdelivr\.net\/npm\/leaflet@1\.9\.4\/dist\/leaflet\.js"><\/script>/g,
    `<script src="/vendor/leaflet/leaflet.js"></script>`,
  ],
];

// ── Apply to all HTML files ────────────────────────────────────────

const htmlFiles = readdirSync(PUBLIC)
  .filter((f) => f.endsWith(".html"))
  .map((f) => path.join(PUBLIC, f));

let totalChanges = 0;

for (const file of htmlFiles) {
  let content = readFileSync(file, "utf-8");
  const original = content;

  for (const [search, replace] of replacements) {
    content = content.replace(search, replace);
  }

  if (content !== original) {
    writeFileSync(file, content, "utf-8");
    const name = path.basename(file);
    console.log(`  ✓ ${name}`);
    totalChanges++;
  }
}

console.log(`\nPatched ${totalChanges} HTML files.`);
