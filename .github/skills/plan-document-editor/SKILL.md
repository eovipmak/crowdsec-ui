---
name: plan-document-editor
description: Research and modify a specified Markdown plan under docs/plans, adding implementation detail or applying exact requirements while preserving internal consistency. Use when asked to update, improve, revise, or complete an existing development plan.
argument-hint: "<path to docs/plans file> [requirements]"
---

# Plan Document Editor

Research before editing a plan document and make the smallest complete change.

## Workflow

1. Confirm the target is a Markdown document under `docs/plans/` and read it in full.
2. Read `AGENTS.md`, referenced files, related source modules, existing task breakdowns, and relevant repository conventions.
3. Identify the requested changes, affected sections, dependent decisions, contradictions, and missing implementation detail.
4. Preserve valid existing requirements and decisions unless the new requirement explicitly supersedes them.
5. Edit the target document in English. Add concrete details for files, interfaces, dependencies, implementation sequence, acceptance criteria, verification, security, and scope boundaries where needed.
6. Reread the complete document and check terminology, references, numbering, dependency order, and exclusions.

## Editing rules

- Do not modify source code or create kanban tasks unless explicitly requested.
- Do not silently resolve a material conflict; record the chosen assumption or ask a focused question.
- Keep architecture consistent with repository evidence and existing plans.
- Do not add speculative infrastructure, databases, identity systems, monitoring, or deployment mechanisms.
- Keep examples safe: never add real credentials, tokens, or sensitive host data.
- Use `edit_file` for targeted changes and preserve surrounding formatting.

## Required final checks

- Every requested requirement appears in the plan.
- Every affected requirement has an implementation task and acceptance criterion.
- All referenced paths and commands are plausible and clearly labeled when pending validation.
- Out-of-scope items remain explicit.
- The document has no contradictory decisions or stale section references.

## Completion report

Report the modified path, changed sections, decisions made, assumptions retained, and unresolved issues.
