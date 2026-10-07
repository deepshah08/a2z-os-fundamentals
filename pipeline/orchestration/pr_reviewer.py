#!/usr/bin/env python3
"""
Automated PR Reviewer & Self-Healing Feedback Loop
Scans open PRs across all 10 curriculums:
  - Fetches PR branch
  - Executes 3-Stage Quality Test Suite (audit-all-widgets.js + e2e-browser-audit.py)
  - On Failure: Extracts error traces, comments on PR, and formats feedback for Jules session
  - On Success: Approves, merges (squash), and updates ledger
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
from typing import Dict, Any, List, Optional, Tuple

from jules_manager import load_ledger, save_ledger, update_session

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

def list_open_prs(repo_name: str) -> List[Dict[str, Any]]:
    full_repo = f"deepshah08/{repo_name}"
    cmd = [
        "gh", "pr", "list",
        "--repo", full_repo,
        "--state", "open",
        "--json", "number,title,headRefName,url,author,createdAt,body"
    ]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        if res.returncode == 0:
            return json.loads(res.stdout or "[]")
        return []
    except Exception as e:
        print(f"⚠️ Error checking PRs for {full_repo}: {e}")
        return []

def run_test_suite_on_branch(repo_name: str, head_branch: str) -> Tuple[bool, str]:
    repo_path = os.path.join(WORKSPACE_DIR, repo_name)
    if not os.path.exists(repo_path):
        return False, f"Repository path {repo_path} does not exist"

    # Use a temporary git worktree so we don't disrupt current working directory
    tmp_worktree = tempfile.mkdtemp(prefix=f"pr-audit-{repo_name}-")
    try:
        # Fetch PR branch from origin
        subprocess.run(
            ["git", "-C", repo_path, "fetch", "origin", head_branch],
            capture_output=True, text=True, timeout=30
        )
        # Add worktree
        add_res = subprocess.run(
            ["git", "-C", repo_path, "worktree", "add", tmp_worktree, f"origin/{head_branch}"],
            capture_output=True, text=True, timeout=15
        )
        if add_res.returncode != 0:
            # Fallback to direct checkout if worktree fails
            return False, f"Failed to checkout PR branch: {add_res.stderr}"

        # 1. Run Stage 1 & 2
        cmd_stage12 = ["node", "tests/audit-all-widgets.js"]
        p12 = subprocess.run(cmd_stage12, cwd=tmp_worktree, capture_output=True, text=True, timeout=30)
        if p12.returncode != 0:
            return False, f"Stage 1/2 Unit & Reactivity Audit Failed:\n{p12.stdout}\n{p12.stderr}"

        # 2. Run Stage 3
        cmd_stage3 = ["python3", "tests/e2e-browser-audit.py"]
        p3 = subprocess.run(cmd_stage3, cwd=tmp_worktree, capture_output=True, text=True, timeout=60)
        if p3.returncode != 0:
            return False, f"Stage 3 Headless Chrome E2E Audit Failed:\n{p3.stdout}\n{p3.stderr}"

        return True, "All 3 Quality Gate Stages Passed (Static DOM, Reactivity, Live Headless Chrome)!"

    finally:
        # Remove worktree
        subprocess.run(["git", "-C", repo_path, "worktree", "remove", "--force", tmp_worktree], capture_output=True)
        shutil.rmtree(tmp_worktree, ignore_errors=True)

def review_open_prs(auto_merge: bool = True) -> List[Dict[str, Any]]:
    results = []
    print("\n======================================================")
    print("AUTOMATED PR QUALITY REVIEW & SELF-HEALING ENGINE")
    print("======================================================")

    for repo_name in REPOSITORIES:
        prs = list_open_prs(repo_name)
        if not prs:
            continue

        full_repo = f"deepshah08/{repo_name}"
        print(f"\n📂 {full_repo}: Found {len(prs)} open PR(s)")

        for pr in prs:
            pr_num = pr["number"]
            pr_title = pr["title"]
            head_branch = pr["headRefName"]
            pr_url = pr["url"]
            print(f"  🔍 Auditing PR #{pr_num}: \"{pr_title}\" ({head_branch})...")

            passed, details = run_test_suite_on_branch(repo_name, head_branch)
            status_entry = {
                "repo": repo_name,
                "pr_number": pr_num,
                "title": pr_title,
                "url": pr_url,
                "passed": passed,
                "details": details
            }
            results.append(status_entry)

            if passed:
                print(f"     ✅ PASSED Quality Gate!")
                if auto_merge:
                    # Approve
                    subprocess.run([
                        "gh", "pr", "review", str(pr_num),
                        "--repo", full_repo,
                        "--approve",
                        "--body", "✨ **Quality Gate Passed**: Verified via 3-Stage Automated Quality Suite (KaTeX formatting, interactive simulator reactivity, headless Chrome compositor raster)."
                    ], capture_output=True)
                    # Squash Merge
                    merge_res = subprocess.run([
                        "gh", "pr", "merge", str(pr_num),
                        "--repo", full_repo,
                        "--squash",
                        "--delete-branch"
                    ], capture_output=True, text=True)
                    if merge_res.returncode == 0:
                        print(f"     🚀 Merged PR #{pr_num} into main!")
                        update_session(
                            session_id=str(pr_num),
                            status="completed",
                            pr_url=pr_url,
                            event_message="PR passed tests and merged automatically."
                        )
                    else:
                        print(f"     ⚠️ Merge warning: {merge_res.stderr.strip()}")
            else:
                print(f"     ❌ FAILED Quality Gate. Formatting feedback...")
                # Comment failure trace on PR
                feedback_body = f"""### ⚠️ Automated Quality Gate Failed

The automated 3-stage validation suite caught issues on this branch:

```text
{details[:2000]}
```

**Required remediation**:
1. Check that all canvas elements match their `data-viz` registrations.
2. Ensure segmented controls use `.seg-track` and set `aria-pressed="true"`.
3. Verify zero uncaught JavaScript errors in headless browser.
"""
                subprocess.run([
                    "gh", "pr", "comment", str(pr_num),
                    "--repo", full_repo,
                    "--body", feedback_body
                ], capture_output=True)
                print(f"     💬 Posted diagnostic feedback on PR #{pr_num}")

    print("\n======================================================\n")
    return results

if __name__ == "__main__":
    review_open_prs(auto_merge=True)
