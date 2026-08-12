---
name: feature-development-planner
description: Research repository structure and requirements, then create a complete feature development plan in docs/plans. Use when asked to design, plan, scope, or architect a new feature or project change before implementation.
argument-hint: "<feature or requirement>"
---

# Feature Development Planner

Create an implementation-ready plan without changing source code.

## Workflow

1. Read `AGENTS.md`, the relevant `README`, package/module manifests, existing plans, and repository structure.
2. Search for related features, interfaces, conventions, tests, deployment files, and documentation before proposing files or APIs.
3. Extract requirements from the prompt and repository evidence. Record explicit assumptions for details that are not specified.
4. Choose the smallest architecture that fits existing patterns. Preserve project constraints such as native deployment, single-admin security, or no database when they apply.
5. Write an English Markdown plan under `docs/plans/` using a descriptive lowercase-hyphenated filename. Include the current date when the repository convention uses dates.

## Required plan content

- Goal and non-goals.
- Current-state findings and relevant files.
- Proposed architecture and data/control flow.
- Exact files or directories to create and modify.
- Interfaces, schemas, routes, commands, and configuration contracts.
- Ordered implementation tasks with dependencies and parallelization notes.
- Acceptance criteria and verification commands/checks.
- Security, compatibility, migration, and operational considerations.
- Risks, unresolved assumptions, and reviewer ownership.

## Rules

- Do not implement code, modify existing source, or create kanban tasks while creating the plan.
- Do not invent APIs, commands, dependencies, or test commands without labeling them as decisions to validate.
- Prefer existing project patterns over new abstractions.
- Keep scope lean and explicitly exclude unrelated infrastructure.
- If requirements are materially ambiguous, ask focused questions; otherwise proceed with documented assumptions.
- After writing, reread the plan and check that every requirement maps to a task and acceptance criterion.

## Completion report

State the plan path, key decisions, assumptions, dependencies, and any questions that must be answered before implementation.
