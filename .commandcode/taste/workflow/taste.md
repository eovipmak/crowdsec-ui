# Workflow Preferences

- Skeptical of heavy QA/testing/CI/CD infrastructure for initial versions of internal tools. Removed testing milestones, CI/CD pipelines, QA staffing, and monitoring programs from the development plan. Confidence: 0.85
- Prefers lean milestone sequences: requirements → backend → frontend → auth → deployment → documentation. Avoids bloated phase-gate processes. Confidence: 0.85
- Uses todo/task tracking to organize multi-step work and mark progress. Confidence: 0.7
- Approves plans before implementation and expects verification scans (e.g., grep for residual scope) after major document rewrites. Confidence: 0.8
- Prefers repository-specific, focused Command Code agents mapped to concrete plan workstreams rather than broad or generic agents. Confidence: 0.85
- Wants implementation tasks to be self-contained and specific enough for agents to execute without clarification or uncertainty about scope. Confidence: 0.95
- Organizes task artifacts under `docs/kanban/[$date]_[$plan-name]/task-[$number].md`. Confidence: 0.9
- Prefers a reusable four-stage workflow: create a feature plan, edit/research an existing plan, break plans into executable kanban tasks, and coordinate agents to execute those tasks. Confidence: 0.95
- Requires delegated kanban execution agents to use the exact model `deepseek/deepseek-v4-flash`. Confidence: 0.95
- Prefers project-scoped skills under `.commandcode/skills/` with matching lowercase-hyphenated names and self-contained `SKILL.md` instructions. Confidence: 0.9
