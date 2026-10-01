# Explorable Curriculum Pipeline: Architecture & Standard Operating Procedure

> **The Universal Blueprint for Building Interactive Computer Science Fundamentals**  
> Inspired by *LLMs, Token by Token* & *Operating Systems, Cycle by Cycle*.  
> Can be spun up for **Networking**, **Distributed Systems**, **Database Internals**, **Compilers**, **Storage Engines**, or any technical domain.

---

## 🎯 1. The Core Philosophy

Technical documentation and textbooks are often dense, static, and passive. Static text tells students *what* an algorithm does; an **interactive explorable** lets students *break* the algorithm, manipulate edge cases, and watch hardware/software states evolve cycle by cycle.

To achieve reference-grade quality, every subject webapp must uphold five pillars:
1. **Zero-Build, Pure Web Standards**: Vanilla ES6+ JavaScript, CSS3 with `color-scheme: light dark`, and HTML5. No bloated bundlers (Vite, Webpack, React runtime) that rot or fail five years later.
2. **Deterministic, Responsive Canvas Engine**: High-DPI canvas scaling (`window.devicePixelRatio`), auto-resize via `ResizeObserver`, and automatic dark/light theme token synchronization.
3. **Rigorous Canonical Curricular Synthesis**: Sourced directly from top academic textbooks (e.g., OSTEP, Kurose & Ross, Kleppmann, Dragon Book) synthesized into ~25–30 atomic chapters grouped across 4 parts.
4. **Rich Dual-Mode Simulators**: Every simulator must be more than a static diagram — it must be an interactive laboratory with state transitions, buttons, sliders, and real mathematical formulas.
5. **Zero-Defect Automated Test Harness**: An automated headless test suite (`audit-all-widgets.js`) that mounts every visualizer, exercises every button, slider, and dropdown at 4 viewports (320px, 480px, 768px, 1200px), and verifies zero NaN coordinates or unhandled exceptions.

---

## 🛠️ 2. Step-by-Step Pipeline from Scratch to Production

### Phase 1: Curricular Gathering & Scope Definition
1. **Identify 2–3 Canonical Textbooks**:
   - *Operating Systems*: OSTEP (Arpaci-Dusseau), Tanenbaum, Dinosaur Book (Silberschatz).
   - *Networking*: Kurose & Ross (*Computer Networking: A Top-Down Approach*), Peterson & Davie.
   - *Distributed Systems*: Martin Kleppmann (*Designing Data-Intensive Applications*), Tanenbaum & Van Steen.
   - *Database Internals*: Alex Petrov (*Database Internals*), Ramakrishnan & Gehrke (*Cow Book*).
2. **Structure into 4 Logical Parts & 25–30 Chapters**:
   - Each chapter should address **one core mental model** (e.g., Two-Phase Commit, B-Tree splitting, TCP Congestion Control, Paxos/Raft leader election).
   - Chapter word count target: 200–400 words of punchy, high-signal editorial prose, accompanied by an analogy callout, a formula/code block, and an interactive widget.

### Phase 2: Interactive Simulator Taxonomy
Select the appropriate simulator pattern for each chapter:
- **Hero Simulator (Top of Page)**: The signature algorithm of the domain (e.g., CPU Scheduler, TCP Sliding Window, Raft Quorum).
- **Protocol / State Machine Stepper**: Step through state transitions with Next/Prev controls (e.g., Dual-mode syscall, TCP 3-Way Handshake, 2PC Commit).
- **Resource Contention / Race Condition Lab**: Demonstrates concurrency bugs (e.g., Lost updates, Deadlock dining philosophers, Split-brain network partition).
- **Translation / Address Lookup Hierarchy**: Shows multi-stage mapping (e.g., Virtual $\to$ Physical paging, Inode resolution, DNS iterative resolution).
- **Mathematical Curve / Tuning Arena**: Sliders that update real-time formulas (e.g., Working set thrashing curve, RAID rebuild times, Little's Law queueing).

### Phase 3: Zero-Dependency Design System
All visualizers inherit tokens directly from CSS variables:
```css
:root {
  --bg: #f8fafc;
  --surface: #ffffff;
  --sunk: #f1f5f9;
  --ink: #0f172a;
  --muted: #64748b;
  --accent: #2563eb;
  --line: #e2e8f0;
}
[data-theme="dark"] {
  --bg: #090d16;
  --surface: #111827;
  --sunk: #1f2937;
  --ink: #f9fafb;
  --muted: #9ca3af;
  --accent: #60a5fa;
  --line: #374151;
}
```
In JavaScript, use `OS.C.accent`, `OS.C.sunk`, `OS.font(12, 'mono', 600)`, and `OS.canvas(...)` to ensure widgets automatically adapt between dark and light modes.

### Phase 4: Automated Testing & Edge-Case Elimination
Run the automated test runner:
```bash
npm test
```
The test harness ensures:
- Every interactive element (`button`, `input[type="range"]`, `select`) executes without crashing.
- Every state transition handles consecutive clicks (no broken one-way transitions).
- Coordinates passed to Canvas API are strictly finite numbers (zero `NaN` or `Infinity`).
- Viewports at 320px (mobile) do not clip labels or overflow bounding boxes.

### Phase 5: Permanent Hosting (Zero Expiration)
1. Initialize git and commit:
   ```bash
   git init && git add . && git commit -m "feat: initial release"
   ```
2. Create repository and configure GitHub Pages:
   ```bash
   gh repo create <repo-name> --public --source=. --remote=origin --push
   gh api -X POST repos/:owner/<repo-name>/pages -f source='{"branch":"main","path":"/"}'
   ```
3. GitHub Pages deploys over permanent HTTPS with zero expiration.

---

## ⚡ 3. Instant Scaffolding CLI

To scaffold a complete, production-ready interactive curriculum for any subject, run:

```bash
node pipeline/scaffold.js --title "Computer Networking, Packet by Packet" --short "a2z-networks-fundamentals" --theme "networks"
```

This immediately creates:
- `index.html`: Pre-wired chapters, responsive TOC, light/dark switcher, hero stage.
- `assets/style.css`: Complete typography and design token stylesheet.
- `assets/core.js`: Reactive canvas management and UI components.
- `assets/viz-hero.js`: Hero visualizer with live controls.
- `tests/audit-all-widgets.js`: Full automated audit suite.
- `package.json`: With pre-configured `npm test` script.
