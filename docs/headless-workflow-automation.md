# Headless Workflow Automation Guide

Automates the full feature chain you run manually today:

`feature-development-planner` → `plan-task-breakdown` → `kanban-task-coordinator` → `git commit` + `git push`

via Command Code headless mode (`cmd -p`). One shell script replaces 4 manual invocations.

## 1. Why Headless

Interactive sessions (`cmd`) require you to type each `/skill` and wait. Headless (`cmd -p "query"`) runs non-interactively: query in, stdout out, exit code signals success/failure. Ideal for scripting, CI, and chaining skills without UI.

References: [Headless Mode](https://commandcode.ai/docs/headless) · [CLI Reference](https://commandcode.ai/docs/reference/cli)

## 2. Prerequisites

- `cmd` installed and authenticated (`cmd status` returns ok, `cmd --list-models` includes `meta/muse-spark-1.2-contributor`).
- Repo clean (`git status` clean) before automation — coordinator preserves uncommitted changes but a clean tree avoids ambiguity.
- Token budget: **1–2 features/day** on `meta/muse-spark-1.2-contributor` per your conservation rule. The script enforces this via model pinning and daily guard.

## 3. Headless Flags You Need

| Flag | Why |
|------|-----|
| `-p, --print "query"` | Enters headless mode (required) |
| `--yolo` (`--dangerously-skip-permissions`) | Allows file writes/edits + shell commands. Without it, all 3 skills are blocked (they create `docs/plans/*.md` and `docs/kanban/**/task-*.md` and delegated agents edit source) |
| `-m, --model meta/muse-spark-1.2-contributor` | Pins every run to your conservation model. The coordinator skill also mandates this model for delegated agents |
| `--verbose` | Prints `session: <id>` to stderr — needed only if you chain with `--resume` |
| `--output-format json` | NDJSON stream (`{"type":"event"}` + final `{"type":"result","subtype":"success"}`) for programmatic exit-code/usage parsing |
| `--max-turns 100` | Default 100 agentic turns; raise if a plan is large. Exit `8` means cap hit |
| `-c, --continue` / `-r, --resume <id>` | Chain context across runs (optional, see §6) |

> Wrap queries in quotes. `--yolo` only in trusted local/CI environments.

Minimal probe:

```bash
cmd -p "explain what this repo does" --verbose
echo $?  # 0 = success, see headless docs for codes 1/3/8/10
```

## 4. Automated Chain (4 Steps)

Each step is one `cmd -p` call. Pass the skill as a slash command in the query — headless loads skills the same as interactive.

### Step 1 — Research & Plan

```bash
# Exploratory (no argument): researches repo, ranks 3-5 candidates, writes docs/plans/YYYY-MM-DD_*.md
cmd -p "/feature-development-planner" --yolo -m meta/muse-spark-1.2-contributor

# Explicit feature:
cmd -p "/feature-development-planner add time-range filtering to alerts" --yolo -m meta/muse-spark-1.2-contributor
```

Output: `docs/plans/<date>_<slug>.md`. Capture the newest plan:

```bash
PLAN=$(ls -t docs/plans/*.md | head -n1)
echo "$PLAN"
```

### Step 2 — Break Down to Kanban

```bash
cmd -p "/plan-task-breakdown $PLAN" --yolo -m meta/muse-spark-1.2-contributor
```

Output: `docs/kanban/YYYY-MM-DD_<plan-name>/task-01.md` … `task-N.md` (2–4 tasks for small features; more only for independent workstreams).

```bash
KANBAN=$(ls -td docs/kanban/*/ | head -n1)
echo "$KANBAN"
```

### Step 3 — Coordinate Execution

Coordinator caps at **3 tasks in-flight**, runs independent tasks in parallel, and may need re-invocation for remaining waves.

```bash
cmd -p "/kanban-task-coordinator $KANBAN" --yolo -m meta/muse-spark-1.2-contributor
# If report lists "next batch: task-0x …", re-run the same command until "fully complete"
```

Loop form (handles multi-wave plans automatically):

```bash
until cmd -p "/kanban-task-coordinator $KANBAN" --yolo -m meta/muse-spark-1.2-contributor 2>&1 | grep -qi "fully complete"; do
  echo "Next wave…"
done
```

Each task appends `## Coordinator status — Status: completed` only after verification passes. The coordinator skips those on re-runs.

### Step 4 — Commit & Push

Manual today, automated as the last script step (only if steps 1–3 exited 0):

```bash
git add -A
git commit -m "feat: $(basename "$PLAN" .md)

Co-authored-by: CommandCodeBot <noreply@commandcode.ai>"
git push
```

## 5. Complete Script (Copy-Paste)

Save as `scripts/auto-feature.sh`, `chmod +x` it, and run from repo root.

```bash
#!/usr/bin/env bash
set -euo pipefail

MODEL="meta/muse-spark-1.2-contributor"
FEATURE_PROMPT="${1:-}"  # optional: "add X" — empty means exploratory

# Daily guard: warn if 2 plans already created today
TODAY=$(date +%Y-%m-%d)
TODAY_COUNT=$(ls docs/plans/${TODAY}_*.md 2>/dev/null | wc -l)
if [ "$TODAY_COUNT" -ge 2 ]; then
  echo "⚠  $TODAY_COUNT plan(s) already exist today ($TODAY). Limit is 1-2/day." >&2
  echo "   Continue anyway? [y/N]" >&2
  read -r ans; [ "$ans" = "y" ] || exit 0
fi

echo "== Step 1: feature-development-planner =="
if [ -z "$FEATURE_PROMPT" ]; then
  cmd -p "/feature-development-planner" --yolo -m "$MODEL"
else
  cmd -p "/feature-development-planner $FEATURE_PROMPT" --yolo -m "$MODEL"
fi

PLAN=$(ls -t docs/plans/*.md | head -n1)
echo "Plan: $PLAN"

echo "== Step 2: plan-task-breakdown =="
cmd -p "/plan-task-breakdown $PLAN" --yolo -m "$MODEL"

KANBAN=$(ls -td docs/kanban/*/ | head -n1)
echo "Kanban: $KANBAN"

echo "== Step 3: kanban-task-coordinator (loops until complete) =="
ATTEMPTS=0
MAX_ATTEMPTS=5
while [ $ATTEMPTS -lt $MAX_ATTEMPTS ]; do
  ATTEMPTS=$((ATTEMPTS+1))
  echo "--- Coordinator pass $ATTEMPTS ---"
  OUT=$(mktemp)
  if cmd -p "/kanban-task-coordinator $KANBAN" --yolo -m "$MODEL" 2>&1 | tee "$OUT"; then
    if grep -qi "fully complete" "$OUT"; then
      echo "All tasks complete."
      rm -f "$OUT"
      break
    fi
    if ! grep -qi "next batch" "$OUT" && ! grep -qi "next ready" "$OUT"; then
      echo "No next batch signaled — assuming done."
      rm -f "$OUT"
      break
    fi
    rm -f "$OUT"
  else
    echo "Coordinator pass $ATTEMPTS failed (exit $?). See output above." >&2
    rm -f "$OUT"
    exit 1
  fi
done

echo "== Step 4: git commit & push =="
if [ -n "$(git status --porcelain)" ]; then
  git add -A
  git commit -m "feat: $(basename "$PLAN" .md)

Co-authored-by: CommandCodeBot <noreply@commandcode.ai>"
  git push
  echo "Pushed."
else
  echo "Nothing to commit."
fi

echo "Done. Plan=$PLAN Kanban=$KANBAN"
```

Usage:

```bash
# Exploratory (ranks candidates, picks top — your usual flow)
./scripts/auto-feature.sh

# Explicit feature
./scripts/auto-feature.sh "add time-range filtering to alerts"

# JSON/CI-friendly variant (parse exit codes)
cmd -p "/feature-development-planner" --yolo -m meta/muse-spark-1.2-contributor --output-format json | tail -n1 | python3 -m json.tool
# exit codes: 0 success, 8 max-turns, 10 insufficient credits (stop for the day)
```

## 6. Session Chaining (Optional)

Headless sessions persist to disk, hidden from interactive `/resume`. Chain them when you want later steps to see earlier reasoning without re-reading files:

```bash
cmd -p --verbose "/feature-development-planner" --yolo -m "$MODEL" 2> /tmp/cc.log
SESSION=$(grep -oE 'session: [a-f0-9-]+' /tmp/cc.log | awk '{print $2}')

cmd -p --resume "$SESSION" "/plan-task-breakdown $PLAN" --yolo -m "$MODEL"
# or simply resume latest headless session:
cmd -p --continue "/plan-task-breakdown $PLAN" --yolo -m "$MODEL"
```

`--continue` is usually enough; explicit `--resume <id>` is for parallel runs or CI log correlation.

## 7. Token Conservation

- **Model pinning:** Every `cmd -p` in the script uses `-m meta/muse-spark-1.2-contributor`. Do not override without updating the daily budget.
- **1–2 features/day:** The script warns on the 3rd `docs/plans/YYYY-MM-DD_*.md` per day. For strict enforcement, change the guard to `exit 1`.
- **Batch size:** Prefer one `auto-feature.sh` run per day, then review deeply, rather than 4–5 thin features.
- **Coordinator waves:** The loop caps retries at 5; most small features finish in 1–2 passes. If it loops to the cap, inspect `docs/kanban/<plan>/task-*.md` blockers instead of blindly re-running.
- **JSON usage tracking:** With `--output-format json`, the final `result` line includes `usage` and `durationMs` — pipe to a daily log to audit spend.

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Permission denied` / no files created | Missing `--yolo` | Add `--yolo` (or `--dangerously-skip-permissions`) |
| `Exit 8: max turns` | Plan too large, default 100 turns hit | Re-run with `--max-turns 150` or split the feature |
| `Exit 10: insufficient credits` | Token quota exhausted | Stop for the day; resume tomorrow |
| Coordinator reports `blocked` tasks | Prerequisite failed or missing contract | Open the listed `task-0X.md`, fix blocker, re-run coordinator |
| Push rejected | Remote ahead | `git pull --rebase` then `git push` |
| Headless can't use `ask_user_question`/`todo_write` | Disabled in headless by default | Not needed here; if required, add `--tools-enable ask_user_question,todo_write` or `--tools-all` |

## 9. Manual Fallback

If automation fails mid-chain, resume manually where it stopped:

```bash
ls -t docs/plans/*.md | head -n1        # find plan
ls -td docs/kanban/*/ | head -n1        # find kanban
cmd -p "/kanban-task-coordinator docs/kanban/2026-08-18_simulation-status" --yolo -m meta/muse-spark-1.2-contributor
```

No work is lost — plans and kanban tasks are plain Markdown on disk.

## Sources

- Headless Mode — https://commandcode.ai/docs/headless
- CLI Reference — https://commandcode.ai/docs/reference/cli
- Local skills: `.commandcode/skills/feature-development-planner/SKILL.md`, `.commandcode/skills/plan-task-breakdown/SKILL.md`, `.commandcode/skills/kanban-task-coordinator/SKILL.md`

Sources:
- [Headless Mode](https://commandcode.ai/docs/headless)
- [CLI Reference](https://commandcode.ai/docs/reference/cli)
