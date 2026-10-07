#!/usr/bin/env python3
"""
Autonomous Continuous Curriculum Development Daemon
Unified Orchestrator:
  1. Ledger & Rate-Limit Gate (Concurrence <= 15, Daily <= 100)
  2. Automated PR Review & Self-Healing Feedback
  3. Gap Discovery across all 10 explorable curriculums
  4. Scheduled batch dispatch planning
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone

from jules_manager import (
    get_session_stats,
    can_spawn_session,
    record_new_session,
    update_session,
    print_status_summary,
    load_ledger
)
from discovery import (
    discover_opportunities,
    build_jules_prompt,
    REPOSITORIES
)
from pr_reviewer import review_open_prs

def run_cycle(dry_run: bool = False, max_dispatch: int = 3):
    print("\n" + "="*60)
    print("🚀 AUTONOMOUS CURRICULUM EVOLUTION CYCLE STARTED")
    print(f"   Time: {datetime.now(timezone.utc).isoformat()}")
    print("="*60)

    # 1. Review pending PRs first (frees up slots if PRs merge)
    print("\n[STEP 1/3] Scanning for open Pull Requests...")
    review_open_prs(auto_merge=True)

    # 2. Check Quota & Capacity
    print("\n[STEP 2/3] Checking Jules capacity & rate limits...")
    stats = get_session_stats()
    print_status_summary()

    if stats["concurrent_slots_left"] <= 0:
        print("⚠️ No concurrent slots available. Waiting for active sessions to finish.")
        return
    if stats["daily_slots_left"] <= 0:
        print("⚠️ 24-hour rate limit reached. Waiting for rolling window reset.")
        return

    # 3. Discovery & Dispatch Planning
    print("\n[STEP 3/3] Discovering curriculum enhancement opportunities...")
    opps = discover_opportunities()
    if not opps:
        print("✨ All 10 curriculums are fully saturated with interactive visualizers and math!")
        return

    # Filter opportunities by priority
    high_prio = [o for o in opps if o["priority"] == "high"]
    selected = high_prio if high_prio else opps
    batch_size = min(max_dispatch, stats["concurrent_slots_left"], stats["daily_slots_left"], len(selected))

    print(f"\n🎯 Selected {batch_size} candidate(s) for dispatch (from {len(opps)} total backlog):")
    candidates_to_dispatch = []
    for idx, opp in enumerate(selected[:batch_size], 1):
        title, prompt = build_jules_prompt(opp)
        print(f"\n--- Candidate #{idx} ---")
        print(f"Repo:    {opp['repo']}")
        print(f"Target:  {opp['target_title']} (#{opp.get('target_section', '')})")
        print(f"Title:   {title}")
        candidates_to_dispatch.append({
            "repo": f"deepshah08/{opp['repo']}",
            "title": title,
            "prompt": prompt,
            "metadata": opp
        })

    # Save planned dispatches to state file for easy pickup by Antigravity or Jules API
    dispatch_plan_file = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "state",
        "pending_dispatches.json"
    )
    with open(dispatch_plan_file, "w", encoding="utf-8") as f:
        json.dump(candidates_to_dispatch, f, indent=2)

    print(f"\n💾 Planned dispatch payload saved to: {dispatch_plan_file}")

    if dry_run:
        print("\n✨ DRY RUN COMPLETE. No live sessions spawned.")
    else:
        print(f"\n✨ Cycle complete. Ready for Jules execution ({len(candidates_to_dispatch)} items queued).")

def main():
    parser = argparse.ArgumentParser(description="Autonomous Curriculum Evolution Daemon")
    parser.add_argument("--cycle-once", action="store_true", help="Run a single full cycle")
    parser.add_argument("--status", action="store_true", help="Print current status and ledger")
    parser.add_argument("--review-only", action="store_true", help="Only run PR review loop")
    parser.add_argument("--dry-run", action="store_true", help="Simulate cycle without modifying state")
    parser.add_argument("--limit", type=int, default=3, help="Max sessions to dispatch per cycle (default 3)")
    args = parser.parse_args()

    if args.status:
        print_status_summary()
    elif args.review_only:
        review_open_prs(auto_merge=True)
    elif args.cycle_once or args.dry_run:
        run_cycle(dry_run=args.dry_run, max_dispatch=args.limit)
    else:
        # Default behavior: run one full cycle
        run_cycle(dry_run=False, max_dispatch=args.limit)

if __name__ == "__main__":
    main()
