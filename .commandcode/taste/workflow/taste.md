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
- Prefers delegated-task completion to be verified from the agent's returned result/state and repository artifacts (including filesystem and git checks), rather than trusting a feed label such as “Done” alone. Confidence: 0.9
- Prefers agent-orchestration problems to be diagnosed against authoritative Command Code documentation as well as local coordination skills and task artifacts, distinguishing runtime failures from workflow defects. Confidence: 0.9
- Prefers delegated research agents to remain read-only and return their findings, with the coordinator responsible for validating the response, creating durable artifacts, and updating task status only after acceptance-criteria verification. Confidence: 0.95
- Prefers coordination skills to explicitly distinguish the coordinator, reusable agent definitions, sub-agent worker runs, and the separate task ledger, including clear ownership boundaries for delegation, artifact creation, result collection, and status updates. Confidence: 0.95
- Expects kanban task sets to be schema-complete before coordination: required headings such as `Implementation steps`, `Contracts`, and `Reviewer` should be explicit and validated literally, not inferred from equivalent content. Confidence: 0.9
- Prefers kanban coordination to persist verified task-completion markers in task artifacts so later runs can skip already completed work instead of repeating full checks. Confidence: 0.95
- Values simplicity in deployment over production-orthodox patterns. Initially suggested a dev server over static files for frontend, but reversed course and accepted static serving when presented with concrete production trade-offs (extra port, Node runtime, HMR exposure, memory). Preference is for whichever approach is genuinely simpler, not for dev servers specifically. Confidence: 0.85
