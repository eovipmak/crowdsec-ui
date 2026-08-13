/**
 * Shared domain types for the dashboard shell.
 *
 * Everything here is derived from the task-03 API contract and the task-02
 * command matrix. These are wire types only — the frontend never persists
 * CrowdSec data and never constructs commands. Item shapes that the adapter
 * produces from `cscli -o json` are rendered as known fields and unknown
 * fields are ignored (architecture §7: "renders only known fields").
 */
import type { OperationErrorCode } from "@/lib/api/errors";

// ---------------------------------------------------------------------------
// Envelope (architecture §4.3)
// ---------------------------------------------------------------------------

export interface SourceInfo {
  system: "crowdsec";
  /** Fixed operation label from the matrix — never an executed command line. */
  command: string;
  /** Matrix target version. */
  version: string;
}

/** Adapter-level failure carried inside a 200 operation envelope (§4.5). */
export interface OperationError {
  code: OperationErrorCode;
  message: string;
  retryable: boolean;
}

export interface SuccessEnvelope<T> {
  operation: OperationId;
  request: unknown;
  result: T;
  source: SourceInfo;
}

export interface FailureEnvelope {
  operation: OperationId;
  error: OperationError;
}

/** Read collection payload with the matrix-declared page mode (§4.8). */
export interface PageInfo {
  mode: "limit" | "offset" | "cursor" | "none";
  limit?: number;
  offset?: number;
  cursor?: string;
  has_more: boolean;
}

export interface CollectionResult<T> {
  items: T[];
  page: PageInfo;
}

// ---------------------------------------------------------------------------
// Application routes (architecture §4.6 / §5.2)
// ---------------------------------------------------------------------------

export interface HealthStatus {
  status: "ok";
  service: "crowdsec-dashboard";
  version: string;
  time: string;
}

export interface SessionStatus {
  authenticated: boolean;
  expires_at: string;
  csrf_token: string;
}

export interface SessionResponse {
  session: SessionStatus;
}

export interface LoginRequest {
  password: string;
}

export interface LogoutResponse {
  session: { authenticated: false };
}

/** Per-operation support from the startup probe cache (§5.2). */
export type CapabilityValue = "supported" | "capability_gated" | "unsupported";
export interface CapabilitiesResponse {
  capabilities: Partial<Record<OperationId, CapabilityValue>>;
}

// ---------------------------------------------------------------------------
// Confirmation (architecture §4.6 / §4.7)
// ---------------------------------------------------------------------------

export interface ConfirmationIssuanceRequest {
  operation: MutationOperationId;
  request: Record<string, unknown>;
}

export interface ConfirmationIssuanceResponse {
  confirmation: {
    operation: MutationOperationId;
    token: string;
    expires_at: string;
    action: string;
    command_label: string;
  };
}

// ---------------------------------------------------------------------------
// Reads (architecture §6.1)
// ---------------------------------------------------------------------------

/** Matrix operation identifiers (§5.1) plus the 11 explicitly unsupported rows (§5.3). */
export type OperationId =
  | "alerts.list"
  | "alerts.inspect"
  | "alerts.delete"
  | "decisions.list"
  | "decisions.add"
  | "decisions.delete"
  | "decisions.import"
  | "machines.list"
  | "machines.delete"
  | "machines.prune"
  | "bouncers.list"
  | "bouncers.add"
  | "bouncers.delete"
  | "hub.update"
  | "scenarios.install"
  | "collections.install"
  | "collections.remove"
  | "allowlists.list"
  | "allowlists.check"
  | "allowlists.create"
  | "allowlists.add"
  | "allowlists.import"
  | "allowlists.remove"
  | "allowlists.delete"
  | "metrics.show"
  | "lapi.status"
  | "capi.status";

/** Mutation operations that have functional endpoints (architecture §5.1). */
export type MutationOperationId =
  | "decisions.add"
  | "decisions.delete"
  | "machines.prune"
  | "bouncers.delete"
  | "allowlists.create"
  | "allowlists.add"
  | "allowlists.remove"
  | "allowlists.delete";

/** Rows the matrix marks explicitly unsupported — the UI must never build a functional control for these (§5.3). */
export type UnsupportedOperationId =
  | "alerts.delete"
  | "decisions.import"
  | "machines.delete"
  | "bouncers.add"
  | "hub.update"
  | "scenarios.install"
  | "collections.install"
  | "collections.remove"
  | "allowlists.import";

export const UNSUPPORTED_OPERATIONS: readonly UnsupportedOperationId[] = [
  "alerts.delete",
  "decisions.import",
  "machines.delete",
  "bouncers.add",
  "hub.update",
  "scenarios.install",
  "collections.install",
  "collections.remove",
  "allowlists.import",
] as const;

export function isUnsupportedOperation(op: OperationId): op is UnsupportedOperationId {
  return (UNSUPPORTED_OPERATIONS as readonly string[]).includes(op);
}

// --- alerts.list ------------------------------------------------------------

export type AlertScope = "Ip" | "Range" | "Username" | "ASN" | (string & {});

export interface AlertDecision {
  type: string;
  duration: string;
}

export interface AlertItem {
  id: number;
  start_at: string;
  stop_at?: string;
  scenario: string;
  scope: AlertScope;
  value: string;
  /** Operator-facing columns from the cscli `-m` table (task 02 contract). All optional. */
  country?: string;
  as_number?: string;
  as_name?: string;
  events?: number;
  machine?: string;
  kind?: string;
  reason?: string;
  created_at?: string;
  decisions: AlertDecision[];
  /** Representative shape; the adapter may include extra fields — the UI renders known fields only. */
  [key: string]: unknown;
}

export interface AlertsListRequest {
  limit?: number;
  filter?: {
    scenario?: string;
    ip?: string;
  };
}

// --- alerts.inspect ---------------------------------------------------------

export interface AlertsInspectRequest {
  id: number;
}

// --- decisions.list ---------------------------------------------------------

export interface DecisionItem {
  id: number;
  origin: string;
  type: string;
  scope: string;
  value: string;
  scenario?: string;
  created_at?: string;
  until?: string;
  duration?: string;
  /** Task 02 fields from the parsed cscli blob. All optional. */
  events?: number;
  alert_id?: number;
  country?: string;
  as_number?: string;
  as_name?: string;
  [key: string]: unknown;
}

export interface DecisionsListRequest {
  limit?: number;
  filter?: {
    ip?: string;
    type?: string;
    scenario?: string;
  };
}

// --- mutations (architecture §6.2) ------------------------------------------

export interface DecisionsAddRequest {
  ip_or_range: string;
  duration: string;
  reason: string;
}

export interface DecisionsDeleteRequest {
  ip_or_range: string;
}

export interface MachinesPruneRequest {
  duration?: string;
  not_validated_only?: boolean;
}

export interface BouncersDeleteRequest {
  name: string;
}

export interface AllowlistsCreateRequest {
  name: string;
  description: string;
}

export interface AllowlistsAddRequest {
  name: string;
  ip_or_range: string;
  expiration?: string;
  comment?: string;
}

export interface AllowlistsRemoveRequest {
  name: string;
  ip_or_range: string;
}

export interface AllowlistsDeleteRequest {
  name: string;
}

export type MutationRequestMap = {
  "decisions.add": DecisionsAddRequest;
  "decisions.delete": DecisionsDeleteRequest;
  "machines.prune": MachinesPruneRequest;
  "bouncers.delete": BouncersDeleteRequest;
  "allowlists.create": AllowlistsCreateRequest;
  "allowlists.add": AllowlistsAddRequest;
  "allowlists.remove": AllowlistsRemoveRequest;
  "allowlists.delete": AllowlistsDeleteRequest;
};

export interface MutationResult {
  status: "success";
  action: string;
  refreshed: string[];
}

export interface MutationEnvelope<
  T extends MutationOperationId,
> extends SuccessEnvelope<MutationResult> {
  operation: T;
  request: MutationRequestMap[T];
}

// --- other reads ------------------------------------------------------------

export interface AllowlistsCheckRequest {
  ip_or_range: string;
}

export interface MachineItem {
  machineId?: string;
  ipAddress?: string;
  version?: string;
  last_heartbeat?: string;
  updated_at?: string;
  isValidated?: boolean;
  auth_type?: string;
  os?: string;
  [key: string]: unknown;
}

export interface BouncerItem {
  name: string;
  ip_address?: string;
  type?: string;
  version?: string;
  last_pull?: string;
  [key: string]: unknown;
}

export interface AllowlistEntry {
  ip: string;
  comment?: string;
  source: string;
  expiration?: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface AllowlistItem {
  name: string;
  description?: string;
  source: string;
  entries: AllowlistEntry[];
  [key: string]: unknown;
}

export interface LapiStatus {
  healthy?: boolean;
  message?: string;
  [key: string]: unknown;
}

export interface CapiStatus {
  enabled?: boolean;
  message?: string;
  [key: string]: unknown;
}

export type MetricsComponent = "acquisition" | "appsec" | "lapi";

// ---------------------------------------------------------------------------
// Query parameter builders (architecture §6.1)
// ---------------------------------------------------------------------------

export interface AlertFilterValues {
  scenario?: string;
  ip?: string;
  scope?: string;
  kind?: string;
}

export interface DecisionFilterValues {
  ip?: string;
  scope?: string;
  type?: string;
  origin?: string;
  scenario?: string;
}

function appendQuery(
  params: URLSearchParams,
  key: string,
  value: string | number | undefined | null,
): void {
  if (value !== undefined && value !== null && value !== "") {
    params.append(key, String(value));
  }
}

/**
 * Build the query string for alerts.list. Every parameter is a typed field
 * from the matrix — no free-form text, flags, or expressions can reach the
 * adapter through this builder.
 */
export function alertsListParams(req: AlertsListRequest): URLSearchParams {
  const params = new URLSearchParams();
  appendQuery(params, "limit", req.limit);
  if (req.filter) {
    appendQuery(params, "filter.scenario", req.filter.scenario);
    appendQuery(params, "filter.ip", req.filter.ip);
  }
  return params;
}

/** Build the query string for decisions.list. */
export function decisionsListParams(req: DecisionsListRequest): URLSearchParams {
  const params = new URLSearchParams();
  appendQuery(params, "limit", req.limit);
  if (req.filter) {
    appendQuery(params, "filter.ip", req.filter.ip);
    appendQuery(params, "filter.type", req.filter.type);
    appendQuery(params, "filter.scenario", req.filter.scenario);
  }
  return params;
}
