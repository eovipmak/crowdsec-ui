# CrowdSec Dashboard — Authoritative `cscli` Command Matrix

Status: **MVP baseline**. This document is the sole allowlist for dashboard-to-CrowdSec operations. Backend and frontend work must not add an operation without updating this document and obtaining CrowdSec-domain review.

## 1. Scope and verification

The matrix targets a native Linux/systemd installation and CrowdSec **1.7.8**, the environment represented by the verified project references. Commands marked **environment-dependent** must be probed at startup or reported unsupported; they must not be guessed into existence. The adapter invokes the configured `cscli` executable directly with an argument vector, never through a shell.

The matrix is based on the project references for alerts/decisions/metrics and health checks, machines, hub/components, profiles, and allowlists. `cscli profiles` is explicitly not a supported command through 1.7.8; profiles are read from the configured CrowdSec profiles file and are therefore not an MVP `cscli` operation. Bouncers are listed and removed through `cscli`; registering a new bouncer requires a secret and is not an MVP dashboard mutation.

The matrix intentionally excludes notifications, Console enrollment/management, acquisition editing, arbitrary configuration editing, direct database access, and arbitrary command passthrough. Those are either outside the MVP requirements or require secrets/file authoring outside the strict dashboard adapter boundary.

This revision was validated against the official CrowdSec v1.7.8 documentation (docs.crowdsec.net cscli reference pages) and the v1.7.8 source tree (`cmd/crowdsec-cli/clialert/alerts.go`, `clidecision/decisions.go`, `climachine/prune.go`, `clibouncer/{add,list}.go`, `cliallowlists/allowlists.go`, `cliitem/{cmdinspect,item}.go`, `clihub/{hub,items}.go`, `climetrics/show.go`, `clilapi/status.go`), plus the verified project references under `.commandcode/skills/crowdsec/references/`. Live target-environment execution was not available for this pass; rows marked environment-dependent therefore remain capability-gated and require the target-environment run and CrowdSec-domain sign-off before promotion.

## 2. Common execution contract

### Invocation

* The executable is resolved from server configuration or the controlled service environment. Browser input cannot select it.
* Every row below is a fixed operation identifier plus a fixed argument template. The adapter constructs the complete vector internally.
* No operation accepts shell text, executable paths, raw flags, pipelines, redirections, or filesystem paths from a browser request.
* The adapter captures stdout, stderr, exit status, timeout, cancellation, and missing-executable errors. It never returns raw stderr or command lines to the browser.
* Commands run with the service account's configured permissions. Permission failures are reported as `permission_denied`; they are not retried with elevated privileges.

### Structured output

`-o json` is requested only on rows that explicitly list it as supported. JSON must be a complete value of the expected top-level shape; malformed JSON is `malformed_output`. If the installed command rejects `-o json`, the adapter returns `unsupported` for that operation rather than parsing human output as if it were stable. `-o raw` is used only where the row says so and is parsed according to its documented columns.

A successful empty collection is valid and returns `items: []`, not an error. A non-zero exit is a command failure; expected classes are `invalid_parameters`, `permission_denied`, `unavailable`, `timeout`, `unsupported`, and `crowdsec_failure`. The API layer supplies safe messages such as “CrowdSec rejected the requested operation” and includes a stable operation error code, never secrets or untrusted diagnostic text.

### Typed request and response envelope

All operations use this envelope:

```json
{
  "operation": "alerts.list",
  "request": { "limit": 50 },
  "result": { "items": [], "page": { "mode": "limit", "limit": 50, "offset": 0, "has_more": false } },
  "source": { "system": "crowdsec", "command": "cscli alerts list", "version": "1.7.8" }
}
```

Failure envelope:

```json
{
  "operation": "alerts.list",
  "error": {
    "code": "unsupported",
    "message": "This CrowdSec installation does not support the requested operation.",
    "retryable": false
  }
}
```

`source.command` is a fixed operation label, not the executed argument string. It must not expose credentials, paths, or raw stderr.

## 3. Parameter types and common rules

* `limit`: integer 1–500; default 50 unless the operation row documents a CrowdSec default. The adapter adds `-l <limit>` only where supported. CrowdSec defaults are 50 for alerts and 100 for decisions.
* `offset`: integer 0–100000. The adapter applies offset only where the command has a verified offset/page flag. Otherwise offset is unsupported; it must not fetch unbounded data and slice it silently.
* `id`: integer greater than zero.
* `ip_or_range`: validated IP or CIDR using a standard parser; no arbitrary scope/value strings.
* `name`: non-empty CrowdSec identifier matching `^[A-Za-z0-9][A-Za-z0-9_./:-]{0,255}$`; no `/`, `--`, or whitespace is accepted as a free-form argument unless the fixed command requires a hub identifier containing `/`.
* `scenario`: a validated hub/scenario identifier using the same identifier rule.
* `duration`: a finite positive duration accepted by the adapter grammar (`^[0-9]+(s|m|h|d)$`) and bounded to 365 days.
* `reason`: UTF-8 text, 1–256 characters, newline-free; passed as one argument only.
* `filter`: only the named enum fields listed by a row are accepted. No CrowdSec expression language, SQL, regex, or flag string comes from the browser.
* Mutations require an authenticated administrator. Destructive or multi-item mutations require an explicit confirmation token tied to the typed request and operation.

Pagination is command-specific. A response must state `page.mode` as `limit`, `offset`, `cursor`, or `none`. The frontend cannot claim pagination when the command does not provide it.

## 4. Authoritative operation rows

| Operation / consumer | Exact argument vector | Output and parsing | Typed request / pagination | R/W, confirmation, refresh | Support and failures |
|---|---|---|---|---|---|
| `alerts.list` — overview, alerts | `alerts list -o json` plus optional fixed `-l <limit>` and supported filter flags | JSON array of alert objects; reject malformed/non-array output | `{limit, filter?: {scenario?, ip?, scope?, kind?}}`; page mode `limit` only when `-l` is accepted; otherwise `none` | Read; refresh alerts and overview count | Verified command group. Filter/JSON flags are version-dependent and must be probed; invalid filter is `invalid_parameters`, rejected command is `unsupported`. |
| `alerts.inspect` — alert detail | `alerts inspect <id> -o json` | JSON object or documented single-item JSON; reject arrays/malformed output | `{id}`; page mode `none` | Read; no refresh required | Verified command group; JSON support is environment-dependent. Missing id is `invalid_parameters`; absent alert is `crowdsec_failure` mapped to safe not-found. |
| `alerts.delete` — none (explicitly unsupported) | `alerts delete` with filters or `--all` | No adapter parser or handler | `{filters?}`; page mode `none` | Unsupported; no confirmation or refresh | **Explicitly unsupported in MVP.** LAPI-host and bulk/filter deletion are not exposed; no UI consumer. |
| `decisions.list` — overview, decisions | `decisions list -o json` plus optional fixed `-l <limit>` and named filters only | JSON array of decisions | `{limit, filter?: {ip?, scope?, type?, origin?, scenario?}}`; CrowdSec default limit 100; page mode `limit` only when accepted, otherwise `none` | Read; refresh decisions and overview count | Verified command group. Do not translate arbitrary query strings into flags. Unsupported filter/JSON flags return `unsupported`. |
| `decisions.add` — decisions | `decisions add --ip <ip_or_range> --duration <duration> --reason <reason>` | Success text is not a stable data source; return typed mutation result and then call `decisions.list` | `{ip_or_range, duration, reason}`; no pagination | Mutation; explicit confirmation because it creates an active decision; refresh decisions | **MVP included, environment-dependent.** Allowlist may reject it; map to `crowdsec_failure`. Never expose `--bypass-allowlist`; it is not allowed. |
| `decisions.delete` — decisions | `decisions delete --ip <ip_or_range>` | Success/failure only; then list affected decisions | `{ip_or_range}`; no pagination | Mutation; explicit confirmation; refresh decisions | **MVP included.** The adapter must never expose `--all`, bulk delete, or arbitrary IDs. Permission and CrowdSec failures are safe typed errors. |
| `decisions.import` — none (explicitly unsupported) | `decisions import -i <file>` or stdin | No adapter parser or handler | `{file}`; page mode `none` | Unsupported; no confirmation or refresh | **Explicitly unsupported in MVP.** File/stdin bulk import is not exposed; no UI consumer. |
| `machines.list` — overview, machines/status | `machines list -o json` when accepted; otherwise fixed human-output parser is not permitted | JSON array of machine records only | `{}`; page mode `none` | Read; refresh machines/status | Verified command group; structured output is environment-dependent. Empty list is valid. |
| `machines.delete` — none (explicitly unsupported) | `machines delete <name>...` | No adapter parser or handler | `{names}`; page mode `none` | Unsupported; no confirmation or refresh | **Explicitly unsupported in MVP.** Multi-name deletion and `--ignore-missing` are not exposed; no UI consumer. |
| `machines.prune` — machines/status | `machines prune` plus optional fixed `--duration <duration>` and `--not-validated-only`; never `--force` from browser | Mutation result; then `machines.list` | `{duration?, not_validated_only?}`; without `--not-validated-only`, duration must be ≥2m (cscli prompts interactively below 2m); with `--not-validated-only` no minimum applies | Mutation; explicit confirmation because it removes multiple stale registrations; refresh machines | **MVP included only as environment-dependent.** `cscli machines prune` always prompts to confirm permanent removal; the adapter never passes `--force`, so without an approved non-interactive confirmation mechanism the command fails (EOF) and the startup probe must report `unsupported` — no functional control until then. Without `--not-validated-only`, duration must be ≥2m (an additional safety prompt fires below 2m, verified in v1.7.8 source); with `--not-validated-only` no minimum applies. No arbitrary duration or `--force`. |
| `bouncers.list` — overview, bouncers | `bouncers list -o json` when accepted | JSON array of bouncer records; no human fallback | `{}`; page mode `none` | Read; refresh bouncers | Verified command group in triage guidance; structured output must be probed. |
| `bouncers.add` — none (explicitly unsupported) | `bouncers add <name> --key <token>` | No adapter parser or handler | `{name, token}`; page mode `none` | Unsupported; no confirmation or refresh | **Explicitly unsupported in MVP.** Token-bearing registration is not exposed; no UI consumer. |
| `bouncers.delete` — bouncers | `bouncers delete <name>` | Mutation result; then `bouncers.list` | `{name}` | Mutation; explicit confirmation; refresh bouncers | **MVP included only if the command exists and the dashboard runs on the local LAPI host** (`cscli bouncers` requires database access and is intended for the Local API/master host); if the dashboard is not co-located with LAPI, report `unsupported`. Never accept or display the bouncer token. If delete is unsupported, omit the control. |
| `hub.list` — scenarios/collections overview | `hub list -o raw` | CSV rows with fixed columns `name,status,version,description,type`; reject malformed rows and unexpected columns | `{type?: enum(parsers,postoverflows,scenarios,contexts,appsec-configs,appsec-rules,collections)}`; page mode `none` | Read; refresh component views | Verified raw output for hub inventory. `type` is a local filter applied after parsing, not a shell filter; enum values are the plural item-type strings used in the CSV `type` column. |
| `hub.update` — none (explicitly unsupported) | `hub update` with optional content flags | No adapter parser or handler | `{}`; page mode `none` | Unsupported; no confirmation or refresh | **Explicitly unsupported in MVP.** Network index/content updates are not exposed; no UI consumer. |
| `scenarios.list` — scenarios | `scenarios list -o json` when accepted | JSON object keyed by the item type containing an array of scenario records (`{"scenarios":[...]}`); an absent/empty type key is an empty collection. Reject malformed JSON or non-object output. | `{}`; page mode `none` | Read; refresh scenarios | Environment-dependent structured output; no enable/disable control is inferred from listing. |
| `scenarios.inspect` — scenario detail | `scenarios inspect <scenario> -o json` when accepted | JSON object | `{scenario}`; page mode `none` | Read | Environment-dependent; identifier is fixed/validated. |
| `scenarios.install` — scenarios | `scenarios install <scenario>` | Mutation result; then `scenarios.list`/`hub.list` | `{scenario, force?: false}`; `force` is not exposed in MVP | Mutation; explicit confirmation; refresh components | **Not an MVP operation.** Matrix records it to prevent backend invention: component enable/install controls are absent unless a future approved scope adds them. |
| `collections.list` — collections | `collections list -o json` when accepted | JSON object keyed by the item type containing an array of collection records (`{"collections":[...]}`); an absent/empty type key is an empty collection. Reject malformed JSON or non-object output. | `{}`; page mode `none` | Read; refresh collections | Environment-dependent structured output. |
| `collections.install` — collections | `collections install <name>` | Mutation result; then `collections.list`/`hub.list` | `{name}`; no arbitrary flags | Mutation; explicit confirmation; refresh components | **Not an MVP operation.** Listed as explicitly unsupported for current UI/adapter. |
| `collections.remove` — collections | `collections remove <name>`; never add `--force` | Mutation result; then `collections.list`/`hub.list` | `{name}` | Mutation; explicit confirmation; refresh components | **Not an MVP operation.** Removal can affect dependent items; no UI control. |
| `profiles.inspect` — scenarios/profiles | No `cscli` command. Read configured `/etc/crowdsec/profiles.yaml` only through a separately approved configuration-reader boundary | Parsed YAML profile summaries; source path is server-side and never browser-controlled | `{}`; page mode `none` | Read-only; refresh file view | **Supported as read-only only, not a `cscli` operation.** `cscli profiles` does not exist through 1.7.8. No profile editing, expression input, or notification wiring in MVP. |
| `simulation.status` — scenarios/profiles | `simulation status` | Fixed status text parser or supported JSON if verified | `{}`; page mode `none` | Read; refresh simulation status | Verified command. Human output parser must be narrowly tested; malformed output is `malformed_output`. |
| `simulation.enable` — none (explicitly unsupported) | `simulation enable` | No adapter parser or handler | `{}`; page mode `none` | Unsupported; no confirmation or refresh | **Explicitly unsupported in MVP.** Component state toggles are not exposed; no UI consumer. |
| `simulation.disable` — none (explicitly unsupported) | `simulation disable` | No adapter parser or handler | `{}`; page mode `none` | Unsupported; no confirmation or refresh | **Explicitly unsupported in MVP.** Component state toggles are not exposed; no UI consumer. |
| `allowlists.list` — allowlists | `allowlists list -o json` when accepted | JSON array of allowlist records and entries | `{}`; page mode `none` | Read; refresh allowlists | Verified command group; JSON support is environment-dependent. Console-managed entries are read-only. |
| `allowlists.check` — allowlists | `allowlists check <ip_or_range>` | Fixed check result parsed into matches/no-match | `{ip_or_range}`; page mode `none` | Read | Verified command. Invalid IP is rejected before execution. |
| `allowlists.create` — allowlists | `allowlists create <name>` plus required fixed `-d <description>` | Mutation result; then `allowlists.list` | `{name, description}`; description 1–256 chars, required by `cscli` in 1.7.8 | Mutation; explicit confirmation; refresh allowlists | **MVP included for local allowlists.** Console-managed distinction must prevent mutation of remote entries. |
| `allowlists.add` — allowlists | `allowlists add <name> <ip_or_range>` plus optional fixed `-e <duration>` and `-d <comment>` | Mutation result; then `allowlists.list` and `decisions.list` because adding may delete existing decisions | `{name, ip_or_range, expiration?, comment?}`; no pagination | Mutation; explicit confirmation; refresh allowlists and decisions | **MVP included for local allowlists.** Expiration must use the duration grammar. Never accept CSV paths or import flags. |
| `allowlists.import` — none (explicitly unsupported) | `allowlists import -i <file>` | No adapter parser or handler | `{file}`; page mode `none` | Unsupported; no confirmation or refresh | **Explicitly unsupported in MVP.** Browser-controlled file paths and bulk import are not exposed; no UI consumer. |
| `allowlists.remove` — allowlists | `allowlists remove <name> <ip_or_range>` | Mutation result; then `allowlists.list` | `{name, ip_or_range}` | Mutation; explicit confirmation; refresh allowlists | **MVP included for local allowlists.** Console-managed entries are rejected as read-only. |
| `allowlists.delete` — allowlists | `allowlists delete <name>` | Mutation result; then `allowlists.list` | `{name}` | Mutation; explicit confirmation; refresh allowlists | **MVP included for local allowlists.** Console-managed entries and unknown names are rejected; no bulk delete. |
| `metrics.show` — overview, optional statistics | `metrics show <component> -o json` (component from the typed enum) | JSON object shape is component-specific and must be schema-validated per component | `{component: enum(acquisition,appsec,lapi)}`; page mode `none` | Read; refresh only the affected metric card | **Optional/environment-dependent.** Metrics are ordinary CrowdSec data, not Prometheus/Grafana. Unsupported components are reported honestly. `acquisition` is a concrete metric type; `appsec` and `lapi` are cscli aliases that expand to multiple metric types (`appsec` → `appsec-engine`+`appsec-rule`; `lapi` → `alerts`,`decisions`,`lapi`,`lapi-bouncer`,`lapi-decisions`,`lapi-machine`). All three enum values are valid `cscli metrics show` inputs. Unknown metric types return a non-zero exit → `invalid_parameters`; missing/disabled Prometheus config → `unavailable`. JSON is a section-keyed object; schema-validate per component. |
| `lapi.status` — machines/status | `lapi status` | Fixed success/status parser; no human fallback to arbitrary text | `{}`; page mode `none` | Read; refresh status | Verified command. Return `unavailable` or `crowdsec_failure` without raw output. |
| `capi.status` — machines/status | `capi status` | Fixed connectivity/status parser | `{}`; page mode `none` | Read; refresh status | Environment-dependent and optional; no Console enrollment or management mutation. |

## 5. Explicit MVP decisions

### Included mutations

* `decisions.add` and `decisions.delete` are included with narrow target validation and confirmation. `decisions.delete --all`, bulk deletion, `--origin`, `--scenario`, and `--bypass-allowlist` are not allowed.
* Local allowlist create/add/remove/delete are included. Console-managed allowlists are read-only.
* `machines.prune` and `bouncers.delete` are available only when startup capability probing confirms safe support; they require confirmation.

### Excluded mutations

Scenario, parser, collection, hub, profile, simulation, notification, Console, acquisition, and configuration enable/disable/install/remove/edit controls are not MVP adapter operations. The MVP displays current component/profile state where supported but does not turn the dashboard into a configuration editor. In particular, there is no supported `cscli profiles` command, and no invented replacement is permitted.

### No command passthrough

A browser request can select only one of the operation identifiers and its typed request schema. It cannot provide a command name, executable path, shell fragment, raw argument array, flag, pipeline, file path, profile expression, CSV path, token, or CrowdSec configuration text.

## 6. Verification and review checklist

Before implementing each row, the backend reviewer must run the exact fixed vector against the target CrowdSec installation or compare it with the official command behavior for that installed version. Record unsupported/version-dependent results rather than changing the vector silently.

Reviewers must confirm:

1. Empty output is handled as an empty typed collection where applicable.
2. Malformed JSON, malformed raw CSV, unexpected human output, non-zero exit, timeout, missing executable, and permission failure produce distinct safe error classes.
3. Every browser parameter is validated before process start and cannot add an argument.
4. No destructive `--all`, forced overwrite, token-bearing registration, or shell execution is reachable.
5. Every mutation refreshes the source-of-truth operation named in its row.
6. Every frontend control names its matrix operation; unsupported rows produce no functional control.

**Reviewer status:** Verification pass completed 2026-08-08 against official v1.7.8 docs and the v1.7.8 source tree (limitation: no live target environment for this pass). Target-environment execution and CrowdSec-domain sign-off remain required before version-dependent rows may be promoted; until sign-off, version-dependent rows stay capability-gated.
