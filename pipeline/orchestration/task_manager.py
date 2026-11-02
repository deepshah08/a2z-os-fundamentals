#!/usr/bin/env python3
"""
Curriculum Task & Rate Limiting Lifecycle Manager
Tracks task metadata, dispatch state, and PR outcomes in a local ledger.
Supports Gemini AI Studio API and local Antigravity orchestration.
"""

import json
import os
import sys
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple

LEDGER_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "state")
LEDGER_FILE = os.path.join(LEDGER_DIR, "curriculum_ledger.json")

MAX_CONCURRENT_TASKS = 15
MAX_DAILY_TASKS = 100

def _ensure_ledger_file():
    os.makedirs(LEDGER_DIR, exist_ok=True)
    if not os.path.exists(LEDGER_FILE):
        initial = {
            "version": 2,
            "max_concurrent": MAX_CONCURRENT_TASKS,
            "max_daily": MAX_DAILY_TASKS,
            "sessions": []
        }
        with open(LEDGER_FILE, "w", encoding="utf-8") as f:
            json.dump(initial, f, indent=2)

def load_ledger() -> Dict[str, Any]:
    _ensure_ledger_file()
    try:
        with open(LEDGER_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"⚠️ Error loading ledger: {e}. Reinitializing.")
        _ensure_ledger_file()
        with open(LEDGER_FILE, "r", encoding="utf-8") as f:
            return json.load(f)

def save_ledger(data: Dict[str, Any]):
    _ensure_ledger_file()
    tmp_path = LEDGER_FILE + ".tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    os.replace(tmp_path, LEDGER_FILE)

def parse_iso(ts_str: str) -> datetime:
    try:
        return datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
    except Exception:
        return datetime.now(timezone.utc)

def get_session_stats() -> Dict[str, Any]:
    ledger = load_ledger()
    now = datetime.now(timezone.utc)
    one_day_ago = now - timedelta(hours=24)

    active_count = 0
    daily_count = 0
    sessions = ledger.get("sessions", [])

    for s in sessions:
        created = parse_iso(s.get("created_at", ""))
        status = s.get("status", "pending")
        
        # Daily window check
        if created >= one_day_ago:
            daily_count += 1
            
        # Active status check
        if status in ["pending", "in_progress", "busy", "waiting_for_approval"]:
            active_count += 1

    return {
        "active_count": active_count,
        "max_concurrent": MAX_CONCURRENT_TASKS,
        "concurrent_slots_left": max(0, MAX_CONCURRENT_TASKS - active_count),
        "daily_count": daily_count,
        "max_daily": MAX_DAILY_TASKS,
        "daily_slots_left": max(0, MAX_DAILY_TASKS - daily_count),
        "total_recorded": len(sessions)
    }

def can_spawn_session() -> Tuple[bool, str]:
    stats = get_session_stats()
    if stats["active_count"] >= MAX_CONCURRENT_TASKS:
        return False, f"Concurrency limit reached ({stats['active_count']}/{MAX_CONCURRENT_TASKS} active)."
    if stats["daily_count"] >= MAX_DAILY_TASKS:
        return False, f"Daily limit reached ({stats['daily_count']}/{MAX_DAILY_TASKS} in last 24h)."
    return True, f"Capacity available ({stats['concurrent_slots_left']} concurrent, {stats['daily_slots_left']} daily remaining)."

def record_new_session(
    session_id: str,
    repo_name: str,
    title: str,
    prompt: str,
    pr_url: Optional[str] = None
) -> Dict[str, Any]:
    allowed, reason = can_spawn_session()
    if not allowed:
        raise RuntimeError(f"Cannot record session: {reason}")

    ledger = load_ledger()
    now_str = datetime.now(timezone.utc).isoformat()
    record = {
        "id": session_id,
        "repo": repo_name,
        "title": title,
        "prompt": prompt,
        "created_at": now_str,
        "updated_at": now_str,
        "status": "in_progress",
        "pr_url": pr_url,
        "iterations": 1,
        "history": [
            {"timestamp": now_str, "event": "created", "details": f"Task spawned: {title}"}
        ]
    }
    ledger["sessions"].append(record)
    save_ledger(ledger)
    return record

def update_session(
    session_id: str,
    status: Optional[str] = None,
    pr_url: Optional[str] = None,
    event_message: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    ledger = load_ledger()
    target = None
    for s in ledger.get("sessions", []):
        if str(s.get("id")) == str(session_id) or (pr_url and s.get("pr_url") == pr_url):
            target = s
            break

    if not target:
        return None

    now_str = datetime.now(timezone.utc).isoformat()
    target["updated_at"] = now_str
    if status:
        target["status"] = status
    if pr_url:
        target["pr_url"] = pr_url
    if event_message:
        target["history"].append({
            "timestamp": now_str,
            "event": "update",
            "details": event_message
        })
    target["iterations"] = target.get("iterations", 1) + 1

    save_ledger(ledger)
    return target

def print_status_summary():
    stats = get_session_stats()
    print("=" * 60)
    print("CURRICULUM TASK CAPACITY & RATE LIMITING LEDGER")
    print("=" * 60)
    print(f"  Active Concurrent Tasks : {stats['active_count']} / {stats['max_concurrent']} (Available: {stats['concurrent_slots_left']})")
    print(f"  Rolling 24h Dispatches  : {stats['daily_count']} / {stats['max_daily']} (Available: {stats['daily_slots_left']})")
    print(f"  Total Historical Tasks  : {stats['total_recorded']}")
    print("=" * 60)

if __name__ == "__main__":
    print_status_summary()
