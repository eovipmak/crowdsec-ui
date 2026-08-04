---
name: plan-task-breakdown
description: Convert a development plan in docs/plans into self-contained, dependency-aware Markdown tasks for agents under docs/kanban/<date>_<plan-name>. Use when asked to break down, decompose, or prepare a plan for parallel agent execution.
argument-hint: "<path to docs/plans file>"
---

# Plan Task Breakdown

Turn one approved plan into executable kanban task files.

## Workflow

1. Read the complete plan and inspect `AGENTS.md`, repository structure, existing `docs/kanban` examples, and relevant implementation conventions.
2. Extract deliverables, dependencies, reviewer roles, constraints, and explicit exclusions.
3. Choose a safe directory name: `docs/kanban/YYYY-MM-DD_<plan-name>/`. Use the current date unless the plan or request specifies another date. Normalize the plan name to lowercase hyphenated text.
4. Split work into the smallest meaningful agent-sized tasks. Separate discovery/contracts, implementation, integration, deployment, documentation, and final review where they have distinct ownership.
5. Number files consecutively as `task-01.md`, `task-02.md`, and so on.
6. Add dependency and parallelization guidance so an agent can start without asking where to work.

## Required sections in every task

- Objective.
- Prerequisites/dependencies.
- Owner or recommended agent profile.
- Exact files and artifacts to create or modify.
- Concrete implementation steps.
- Interfaces/contracts and integration points.
- Acceptance criteria.
- Verification commands/checks.
- Reviewer.
- Explicit out-of-scope items.

## Rules

- Preserve the plan’s architecture, technology choices, security constraints, and exclusions.
- Do not invent unsupported commands, endpoints, files, or dependencies.
- Make acceptance criteria observable and verification actionable.
- Define what an agent should do when a prerequisite is missing: stop, report the blocker, and do not guess.
- Identify tasks that can run in parallel only when their files and contracts do not conflict.
- Keep every task self-contained; do not require agents to infer requirements from the original plan alone.
- Do not implement the product while creating the breakdown.

## Verification

After writing, list the directory and confirm the complete numbered sequence exists. Read or search all task files to verify required sections are present, dependencies reference real task numbers, and no task violates the plan’s exclusions.

## Completion report

Report the kanban directory, task count, dependency waves, parallelizable groups, and any unresolved plan ambiguity.
