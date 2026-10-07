#!/usr/bin/env python3
"""
Continuous Discovery & Curriculum Opportunity Scanner
Audits all 10 curriculums to locate gaps:
  - Sections lacking interactive simulators
  - Low-coverage mathematical definitions
  - Simulators with single mode or limited controls
Outputs structured improvement candidates ready for Google Jules or Gemini ideation.
"""

import html
import os
import re
import json
from typing import Dict, Any, List, Tuple

REPOSITORIES = [
    "a2z-os-fundamentals",
    "a2z-networks-fundamentals",
    "a2z-system-design",
    "a2z-distributed-systems",
    "a2z-storage-engines",
    "a2z-systems-performance",
    "a2z-garbage-collection",
    "a2z-erasure-coding",
    "a2z-computer-architecture",
    "a2z-cfa-l2-quants"
]

def find_workspace_dir():
    current = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.abspath(os.path.join(current, "../../..")),
        os.path.abspath(os.path.join(current, "../..")),
        os.path.abspath(os.path.join(current, "..")),
        os.getcwd()
    ]
    for p in candidates:
        if any(os.path.exists(os.path.join(p, r)) for r in REPOSITORIES):
            return p
    return candidates[0]

WORKSPACE_DIR = find_workspace_dir()

def scan_repository(repo_name: str) -> Dict[str, Any]:
    repo_path = os.path.join(WORKSPACE_DIR, repo_name)
    html_path = os.path.join(repo_path, "index.html")

    if not os.path.exists(html_path):
        return {"repo": repo_name, "error": "index.html not found"}

    with open(html_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Find all chapter sections: <section id="...">
    section_pattern = re.compile(r'<section\s+id="([^"]+)"[^>]*>(.*?)(?=<section|\Z)', re.DOTALL)
    sections = section_pattern.findall(content)

    chapters_total = len(sections)
    chapters_with_viz = 0
    missing_viz_chapters = []

    for sec_id, sec_body in sections:
        # Check for <figure class="viz" or data-viz="..."
        has_viz = 'data-viz="' in sec_body or 'class="viz' in sec_body
        # Get section title if available
        title_match = re.search(r'<h2[^>]*>(.*?)</h2>', sec_body, re.DOTALL)
        sec_title = html.unescape(re.sub(r'<[^>]+>', '', title_match.group(1)).strip()) if title_match else sec_id

        if has_viz:
            chapters_with_viz += 1
        else:
            missing_viz_chapters.append({
                "id": sec_id,
                "title": sec_title
            })

    # KaTeX count
    body_part = content.split("</head>", 1)[-1] if "</head>" in content else content
    latex_count = body_part.count("$$") + (body_part.count("$") // 2)

    # Registered simulators count from assets/
    assets_dir = os.path.join(repo_path, "assets")
    viz_registrations = 0
    if os.path.exists(assets_dir):
        for fname in os.listdir(assets_dir):
            if fname.startswith("viz-") and fname.endswith(".js"):
                with open(os.path.join(assets_dir, fname), "r", encoding="utf-8") as vf:
                    viz_registrations += len(re.findall(r"OS\.register\s*\(", vf.read()))

    return {
        "repo": repo_name,
        "title": repo_name.replace("a2z-", "").replace("-", " ").title(),
        "total_chapters": chapters_total,
        "interactive_chapters": chapters_with_viz,
        "visualizers_registered": viz_registrations,
        "missing_viz_count": len(missing_viz_chapters),
        "missing_viz_chapters": missing_viz_chapters,
        "latex_formulas_count": latex_count
    }

def discover_opportunities() -> List[Dict[str, Any]]:
    opportunities = []
    for r in REPOSITORIES:
        audit = scan_repository(r)
        if "error" in audit:
            continue

        # Opportunity Type 1: Text-only chapter needing an interactive visualizer
        for missing in audit["missing_viz_chapters"]:
            opportunities.append({
                "type": "add_interactive_visualizer",
                "priority": "high",
                "repo": audit["repo"],
                "target_section": missing["id"],
                "target_title": missing["title"],
                "description": f"Add an explorable canvas simulation to Chapter '{missing['title']}' (#{missing['id']}) in {audit['repo']}."
            })

        # Opportunity Type 2: Math enrichment if low coverage
        if audit["latex_formulas_count"] < 10 and audit["repo"] not in ["a2z-cfa-l2-quants"]:
            opportunities.append({
                "type": "math_enrichment",
                "priority": "medium",
                "repo": audit["repo"],
                "target_section": "all",
                "target_title": "Mathematical Formulas & Rigor",
                "description": f"Add formal mathematical definitions (KaTeX $ / $$) to {audit['repo']} (currently has {audit['latex_formulas_count']} formulas)."
            })

    return opportunities

def build_jules_prompt(opp: Dict[str, Any]) -> Tuple[str, str]:
    repo = opp["repo"]
    sec_id = opp.get("target_section", "")
    sec_title = opp.get("target_title", "")
    opp_type = opp["type"]

    title = f"feat({sec_id or 'core'}): add interactive simulator for {sec_title}"

    prompt = f"""# Explorable Curriculum Enhancement: {sec_title}

## Target Repository
`deepshah08/{repo}`

## Objective
Implement an interactive visualizer for the section `{sec_title}` (ID: `#{sec_id}`) in `index.html`.

## Architectural Guidelines
1. **Zero External Dependencies**: Pure HTML5, CSS3, ES6+ JavaScript. Do not introduce webpack, vite, react, or npm dependencies.
2. **Framework Compatibility**:
   - Register the simulator using `OS.register('{sec_id}Sim', function (host) {{ ... }});` in an existing or new `assets/viz-*.js` file.
   - Use standard helper primitives from `assets/core.js`:
     - `OS.canvas(host, renderFn, {{ autoScale: true }})`
     - `OS.controls(host)`
     - `OS.segmented(controls, {{ label, options, value, onChange }})`
     - `OS.slider(controls, {{ label, min, max, step, value, onChange, format }})`
     - `OS.button(controls, label, onClick, {{ primary: true/false }})`
   - Bind the simulator in `index.html` inside `<section id="{sec_id}">` using:
     ```html
     <figure class="viz" data-viz="{sec_id}Sim">
       <figcaption>Detailed caption describing the interactive visualization.</figcaption>
     </figure>
     ```
3. **Theming & Responsiveness**:
   - Canvas graphics must adapt dynamically to dark and light modes via CSS variables (`--bg`, `--fg`, `--accent`, `--line`).
   - Handles resizing gracefully via devicePixelRatio scaling.
4. **Testing Gate**:
   - Update `tests/audit-all-widgets.js` if necessary to include the new simulator in Stage 2 reactivity tests.
   - Verify that `node tests/audit-all-widgets.js` and `python3 tests/e2e-browser-audit.py` pass with zero failures and zero uncaught exceptions.

Create a clean Pull Request targeting `main`.
"""
    return title, prompt

if __name__ == "__main__":
    opps = discover_opportunities()
    print("\n======================================================")
    print("CONTINUOUS DISCOVERY & OPPORTUNITY BACKLOG")
    print("======================================================")
    print(f"Total enhancement opportunities detected: {len(opps)}\n")
    for idx, o in enumerate(opps[:10], 1):
        print(f"{idx}. [{o['priority'].upper()}] {o['repo']} -> {o['description']}")
    if len(opps) > 10:
        print(f"... and {len(opps) - 10} more opportunities in backlog.")
    print("======================================================\n")
