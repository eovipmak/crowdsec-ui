---
name: bug-report
description: Research codebase to reproduce, diagnose, and document bugs as actionable reports under docs/plans. If invoked without arguments, automatically researches the repo for potential bugs and generates reports. Use when asked to investigate, report, or document a bug, defect, regression, or unexpected behavior.
argument-hint: "[bug description, error message, or reproduction steps — leave empty to auto-research repo for bugs]"
---

# Bug Report

Create an investigation-backed bug report without changing source code. **Default invocation (no arguments) automatically researches the repo for bugs.**

## Workflow

1. Read `AGENTS.md`, the relevant `README`, package/module manifests, existing plans under `docs/plans/`, and repository structure.
2. Determine mode — **if no argument is given, default to exploratory bug research automatically (do not ask for clarification, do not wait for extra input):**
   - **Default / Exploratory (no args or empty prompt):** Scan the repository systematically for potential bugs: error handling gaps, edge cases, recent regressions (git log/diff), open TODOs/FIXMEs, type/lint warnings, unhandled API failures, race conditions, security issues, and UX inconsistencies. Enumerate 3-5 candidate bugs ranked by severity × impact × likelihood, with evidence (file paths, snippets, commit refs). Then proceed to diagnose each candidate.
   - **Explicit bug:** Investigate the reported bug: locate relevant source files, routes, components, logs, and recent commits. Search for related issues, error messages, and reproduction paths. Identify scope and user impact.
3. Attempt to confirm reproduction conditions from code evidence alone (no source edits). Record exact reproduction steps, expected vs actual behavior, environment, and affected surfaces. For default mode, do this for each candidate bug. If reproduction cannot be confirmed statically, state the gap as an assumption to validate.
4. Analyze root cause, contributing factors, and blast radius for each bug. Keep analysis grounded in repository evidence; label speculation explicitly.
5. Propose the smallest fix approach that fits existing patterns. Preserve project constraints such as native deployment and single-admin security when they apply. Do not add unrelated refactoring.
6. Write English Markdown report(s) under `docs/plans/` using a descriptive lowercase-hyphenated filename prefixed with `bug-` or `bugfix-` (e.g., `bug-alert-filter-empty-state.md`). Include the current date when the repository convention uses dates. **For default invocation:** write a consolidated research report (e.g., `bug-research-YYYY-MM-DD.md`) containing the full ranked candidate list with evidence, plus a detailed section for the top 1-2 bugs (reproduction → root cause → fix → verification). If additional candidates warrant separate reports, create individual `bug-*.md` files and link them from the consolidated report. Use `ask_user_question` to let the user pick which bug to fix first when interactive; if no pick is made, leave the research report with all candidates and a recommended priority order.

## Required report content

- Summary and severity/impact (for default mode, per candidate with ranking).
- Reproduction steps, expected vs actual behavior, environment.
- Current-state findings and relevant files (with paths).
- Root cause analysis and contributing factors.
- Proposed fix: exact files or directories to create/modify, approach, and data/control flow if applicable.
- Interfaces, schemas, routes, or configuration affected.
- Verification and acceptance criteria (manual checks and commands to run).
- Security, compatibility, migration, and operational considerations if relevant.
- Risks, unresolved assumptions, and reviewer ownership.
- Non-goals and explicitly out-of-scope items.

## Rules

- Do not implement code, modify existing source, or create kanban tasks while writing the report.
- Do not invent APIs, commands, dependencies, or reproduction logs without labeling them as decisions/assumptions to validate.
- Prefer existing project patterns over new abstractions.
- Keep scope lean and explicitly exclude unrelated infrastructure.
- Explicitly exclude CI/CD, unit tests, testing infrastructure, and monitoring/observability (Grafana/Prometheus/logging platforms, alerting) unless the bug is directly about them or the user explicitly requests them. Do not add pipeline files, test scaffolding, or dashboards to the report.
- Do not add real credentials, tokens, or sensitive host data to the report.
- **Default behavior:** When invoked without arguments, do NOT ask the user what to do — immediately start repository research and generate bug reports. Never remain idle waiting for clarification in this mode.
- If requirements are materially ambiguous in explicit mode, ask focused questions; otherwise proceed with documented assumptions.
- After writing, reread the report and check that every claim traces to repository evidence and that reproduction → root cause → fix → verification forms a consistent chain.

## Completion report

State the report path(s), reproduction status (confirmed vs assumed), root cause summary, proposed fix scope, assumptions, and any questions that must be answered before implementation. For default invocation, also list all candidate bugs found with severity ranking and how the user can select one to proceed.
