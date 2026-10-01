#!/usr/bin/env node

/**
 * Universal Curriculum Generator & Scaffolder
 * Generates an interactive "A-to-Z Fundamentals" web application for any subject.
 * 
 * Usage:
 *   node pipeline/scaffold.js --title "Computer Networks, Packet by Packet" --out ../a2z-networks --short "networks"
 */

const fs = require('fs');
const path = require('path');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    title: 'Computer Networks, Packet by Packet',
    short: 'networks',
    out: './scaffolded-curriculum',
    author: 'Deep Shah'
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--title' && args[i + 1]) options.title = args[++i];
    else if (args[i] === '--short' && args[i + 1]) options.short = args[++i];
    else if (args[i] === '--out' && args[i + 1]) options.out = args[++i];
    else if (args[i] === '--author' && args[i + 1]) options.author = args[++i];
  }
  return options;
}

const opts = parseArgs();
const targetDir = path.resolve(process.cwd(), opts.out);

console.log(`\n🚀 Scaffolding new Explorable Curriculum: "${opts.title}"`);
console.log(`📁 Target Directory: ${targetDir}\n`);

// Create directory tree
const dirs = [
  targetDir,
  path.join(targetDir, 'assets'),
  path.join(targetDir, 'tests')
];

dirs.forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// 1. Generate package.json
const pkgJson = {
  name: `a2z-${opts.short}-fundamentals`,
  version: "1.0.0",
  description: `${opts.title} — An interactive visual field guide`,
  scripts: {
    "test": "node tests/audit-all-widgets.js"
  },
  author: opts.author,
  license: "MIT"
};
fs.writeFileSync(path.join(targetDir, 'package.json'), JSON.stringify(pkgJson, null, 2));

// 2. Copy core.js and style.css from existing solid base
const currentDir = __dirname;
const rootDir = path.resolve(currentDir, '..');

const coreSrc = fs.readFileSync(path.join(rootDir, 'assets', 'core.js'), 'utf8');
const styleSrc = fs.readFileSync(path.join(rootDir, 'assets', 'style.css'), 'utf8');
const testSrc = fs.readFileSync(path.join(rootDir, 'tests', 'audit-all-widgets.js'), 'utf8');

fs.writeFileSync(path.join(targetDir, 'assets', 'core.js'), coreSrc);
fs.writeFileSync(path.join(targetDir, 'assets', 'style.css'), styleSrc);
fs.writeFileSync(path.join(targetDir, 'tests', 'audit-all-widgets.js'), testSrc);

// 3. Generate Hero visualizer (assets/viz-hero.js)
const heroVizCode = `/* ==========================================================================
   ${opts.title} — Hero Visualizer (viz-hero.js)
   ========================================================================== */

(function () {
  'use strict';

  OS.register('heroSim', function (host) {
    let mode = 'active';
    let count = 42;

    const controls = OS.controls(host);
    OS.segmented(controls, {
      label: 'Mode',
      options: [
        { label: 'Normal Mode', value: 'active' },
        { label: 'Diagnostic Mode', value: 'diag' }
      ],
      value: mode,
      onChange: (v) => { mode = v; render(); }
    });

    OS.button(controls, 'Step Simulation ▶', () => {
      count = (count + 7) % 100;
      render();
    }, { primary: true });

    OS.button(controls, 'Reset State', () => {
      count = 42; mode = 'active';
      render();
    });

    const cv = OS.canvas(host, {
      height: 220,
      label: 'Interactive hero simulator stage',
      draw: (ctx, w, h) => {
        ctx.fillStyle = OS.C.sunk;
        ctx.strokeStyle = OS.C.accent;
        ctx.lineWidth = 2;
        ctx.roundRect(20, 20, w - 40, h - 40, 8);
        ctx.fill(); ctx.stroke();

        ctx.fillStyle = OS.C.accent;
        ctx.font = OS.font(14, 'mono', 600);
        ctx.fillText('LIVE INTERACTIVE HERO STAGE', 35, 50);

        ctx.font = OS.font(12, 'mono', 400);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText(\`Current State: \${mode.toUpperCase()} | Metric Counter: \${count}\`, 35, 80);

        // Progress bar
        ctx.fillStyle = OS.rgba(OS.C.accent, 0.2);
        ctx.fillRect(35, 110, w - 70, 24);
        ctx.fillStyle = OS.C.teal;
        ctx.fillRect(35, 110, ((w - 70) * count) / 100, 24);
      }
    });

    const readout = OS.readout(host);
    function render() {
      cv.redraw();
      readout.innerHTML = \`<b>Hero Simulator:</b> Running in <b>\${mode}</b>. Click controls above to observe real-time state changes.\`;
    }
    render();
  });

})();
`;
fs.writeFileSync(path.join(targetDir, 'assets', 'viz-hero.js'), heroVizCode);

// 4. Generate index.html
const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${opts.title}</title>
  <meta name="description" content="An interactive visual field guide to ${opts.title}.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600..800&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="assets/style.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" crossorigin="anonymous">
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js" crossorigin="anonymous"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js" crossorigin="anonymous"
          onload="if (typeof renderMathInElement === 'function') renderMathInElement(document.body, {delimiters: [{left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false}], throwOnError: false});"></script>
</head>
<body>

<header class="site-head">
  <div class="brand">
    <span class="badge">CURRICULUM</span>
    <span class="title">${opts.title}</span>
  </div>
  <button id="theme-toggle" class="theme-toggle" type="button" aria-label="Toggle theme">◐ Theme</button>
</header>

<section class="hero">
  <div class="hero-text">
    <p class="eyebrow">Interactive Systems Field Guide</p>
    <h1>${opts.title}</h1>
    <p class="lede">Synthesizing canonical textbooks and modern production engineering into an interactive, visual field guide.</p>
  </div>
  <figure class="viz viz-hero" data-viz="heroSim">
    <figcaption>Interactive Hero Simulator: Manipulate parameters to observe live state changes.</figcaption>
  </figure>
</section>

<div class="layout">
  <nav class="toc" aria-label="Table of contents">
    <details class="toc-details" open>
      <summary>Chapters</summary>
      <ol class="toc-list">
        <li class="toc-part">Part I · Fundamentals</li>
        <li><a href="#ch-01"><span class="toc-num">01</span><span>First Principles</span></a></li>
      </ol>
    </details>
  </nav>

  <main>
    <div class="part-head" id="part-1">
      <span>Part I</span>
      <h2 class="part-title">Core Fundamentals</h2>
      <p>The architectural foundation and core building blocks.</p>
    </div>

    <section id="ch-01" class="chapter">
      <div class="ch-meta"><span class="ch-num">01</span> <span class="ch-tag">First Principles</span></div>
      <h2>First Principles</h2>
      <p>Welcome to ${opts.title}. Every chapter synthesizes canonical theory with live interactive labs.</p>
      <div class="callout analogy">
        <p class="callout-label">Analogy</p>
        <p>A high-level intuition grounding the theoretical concept in the physical world.</p>
      </div>
    </section>
  </main>
</div>

<footer class="site-foot">
  <p><b>${opts.title}</b> · Built with pure HTML5, CSS3, and ES6+ Canvas. Zero build step required.</p>
</footer>

<script src="assets/core.js"></script>
<script src="assets/viz-hero.js"></script>
<script>
  window.addEventListener('DOMContentLoaded', () => {
    OS.boot();
  });
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(targetDir, 'index.html'), indexHtml);

// 5. Generate README.md
const readmeMd = `# ${opts.title}

> An interactive visual field guide generated via the **Explorable Curriculum Pipeline**.

## 🚀 Getting Started

No build tools or node servers required. Simply open \`index.html\` in any web browser, or run a local static server:

\`\`\`bash
# Local static preview
python3 -m http.server 8080
\`\`\`

## 🧪 Testing

Run the automated interactive audit harness:

\`\`\`bash
npm test
\`\`\`

This validates:
- Every canvas visualizer mounts without errors.
- All buttons, sliders, and selects fire successfully.
- Coordinates remain finite and non-NaN.
- Canvas adapts across 320px, 480px, 768px, and 1200px viewports.

## 🌐 Deploy to GitHub Pages (Permanent URL)

\`\`\`bash
git init
git add .
git commit -m "feat: initial curriculum release"
gh repo create ${opts.short}-fundamentals --public --source=. --remote=origin --push
gh api -X POST repos/:owner/${opts.short}-fundamentals/pages -f source='{"branch":"main","path":"/"}'
\`\`\`
`;
fs.writeFileSync(path.join(targetDir, 'README.md'), readmeMd);

console.log(`✅ Successfully generated project at: ${targetDir}`);
console.log(`👉 To test: cd ${opts.out} && npm test\n`);
