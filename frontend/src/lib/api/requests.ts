/**
 * Typed request builders for the dashboard API.
 *
 * Every operation exposed here corresponds to exactly one matrix row
 * (architecture §5.1). The request surface is a fixed set of typed methods —
 * there is no generic "run command" path, so a browser can never send command
 * text, flags, executable paths, or shell fragments (REQ-014).
 */
import type {
  AlertsInspectRequest,
  AlertsListRequest,
  AllowlistsAddRequest,
  AllowlistsCheckRequest,
  AllowlistsCreateRequest,
  AllowlistsDeleteRequest,
  AllowlistsRemoveRequest,
  BouncersDeleteRequest,
  CapabilitiesResponse,
  ConfirmationIssuanceRequest,
  DecisionsAddRequest,
  DecisionsDeleteRequest,
  DecisionsListRequest,
  LoginRequest,
  MachinesPruneRequest,
  MetricsComponent,
  SessionStatus,
} from "@/lib/api/types";
import { alertsListParams, decisionsListParams } from "@/lib/api/types";

export interface HttpOptions {
  /** CSRF token for state-changing requests (POST/DELETE). */
  csrfToken?: string;
  signal?: AbortSignal;
}

export const API_BASE = "/api/v1";

/**
 * Typed API request builder. Methods return [path, init] pairs consumed by the
 * transport in `client.ts`; keeping them separate makes every request
 * inspectable and testable.
 */
export const apiRequests = {
  // --- application routes (architecture §4.6) ---
  health: () => get("/health"),
  login: (req: LoginRequest): [string, RequestInit] => post("/session", req),
  sessionStatus: () => get("/session"),
  logout: (opts: HttpOptions = {}): [string, RequestInit] =>
    del("/session", { csrfToken: opts.csrfToken }),
  capabilities: () => get("/capabilities"),
  issueConfirmation: (
    req: ConfirmationIssuanceRequest,
    opts: HttpOptions = {},
  ): [string, RequestInit] => post("/confirmations", req, { csrfToken: opts.csrfToken }),

  // --- alerts ---
  alertsList: (req: AlertsListRequest) => getWithParams("/alerts", alertsListParams(req)),
  alertsInspect: (req: AlertsInspectRequest) => get(`/alerts/${req.id}`),

  // --- decisions ---
  decisionsList: (req: DecisionsListRequest) =>
    getWithParams("/decisions", decisionsListParams(req)),
  decisionsAdd: (req: DecisionsAddRequest, opts: HttpOptions = {}): [string, RequestInit] =>
    post("/decisions", { operation: "decisions.add", request: req }, { csrfToken: opts.csrfToken }),
  decisionsDelete: (req: DecisionsDeleteRequest, opts: HttpOptions = {}): [string, RequestInit] =>
    del("/decisions", {
      body: { operation: "decisions.delete", request: req },
      csrfToken: opts.csrfToken,
    }),

  // --- machines ---
  machinesList: () => get("/machines"),
  machinesPrune: (req: MachinesPruneRequest, opts: HttpOptions = {}): [string, RequestInit] =>
    post(
      "/machines/prune",
      { operation: "machines.prune", request: req },
      { csrfToken: opts.csrfToken },
    ),

  // --- bouncers ---
  bouncersList: () => get("/bouncers"),
  bouncersDelete: (req: BouncersDeleteRequest, opts: HttpOptions = {}): [string, RequestInit] =>
    del("/bouncers", {
      body: { operation: "bouncers.delete", request: req },
      csrfToken: opts.csrfToken,
    }),

  // --- simulation / status ---
  // The backend /api/v1/{scenarios,collections,profiles,simulation,hub} routes
  // remain matrix-backed, but the dashboard UI no longer calls them.
  lapiStatus: () => get("/status/lapi"),
  capiStatus: () => get("/status/capi"),

  // --- allowlists ---
  allowlistsList: () => get("/allowlists"),
  allowlistsCheck: (req: AllowlistsCheckRequest) => {
    const params = new URLSearchParams({ ip_or_range: req.ip_or_range });
    return getWithParams("/allowlists/check", params);
  },
  allowlistsCreate: (req: AllowlistsCreateRequest, opts: HttpOptions = {}): [string, RequestInit] =>
    post(
      "/allowlists",
      { operation: "allowlists.create", request: req },
      { csrfToken: opts.csrfToken },
    ),
  allowlistsAdd: (req: AllowlistsAddRequest, opts: HttpOptions = {}): [string, RequestInit] =>
    post(
      "/allowlists/entries",
      { operation: "allowlists.add", request: req },
      { csrfToken: opts.csrfToken },
    ),
  allowlistsRemove: (req: AllowlistsRemoveRequest, opts: HttpOptions = {}): [string, RequestInit] =>
    del("/allowlists/entries", {
      body: { operation: "allowlists.remove", request: req },
      csrfToken: opts.csrfToken,
    }),
  allowlistsDelete: (req: AllowlistsDeleteRequest, opts: HttpOptions = {}): [string, RequestInit] =>
    del("/allowlists", {
      body: { operation: "allowlists.delete", request: req },
      csrfToken: opts.csrfToken,
    }),

  // --- metrics ---
  metricsShow: (component: MetricsComponent) => get(`/metrics/${component}`),
} as const;

// ---------------------------------------------------------------------------
// Low-level helpers (internal)
// ---------------------------------------------------------------------------

/** GET with an already-built parameter set (see alertsListParams/decisionsListParams). */
function getWithParams(path: string, params: URLSearchParams): [string, RequestInit] {
  const qs = params.toString();
  return [qs ? `${url(path)}?${qs}` : url(path), { method: "GET" }];
}

function url(path: string): string {
  // Build the full API URL for a path fragment. Every request path below is
  // expressed as a suffix under API_BASE ("/api/v1"), e.g. "/session".
  // Without this prefix the request would fall through to the frontend
  // asset handler, which only accepts GET/HEAD and returns 405 for POST/
  // DELETE — so e.g. login would render a "dashboard could not be reached"
  // error instead of reaching POST /api/v1/session. Keeping the prefix in
  // one place also keeps the dev-server rewrite rule (next.config.ts) and
  // the production Go routing (architecture §5.1) in sync.
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  return `${API_BASE}${path}`;
}

function get(path: string): [string, RequestInit] {
  return [url(path), { method: "GET" }];
}

function post(
  path: string,
  body: unknown,
  opts: { csrfToken?: string } = {},
): [string, RequestInit] {
  return [
    url(path),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(opts.csrfToken ? { "X-CSRF-Token": opts.csrfToken } : {}),
      },
      body: JSON.stringify(body),
    },
  ];
}

function del(
  path: string,
  opts: { body?: unknown; csrfToken?: string } = {},
): [string, RequestInit] {
  const hasBody = opts.body !== undefined;
  return [
    url(path),
    {
      method: "DELETE",
      headers: {
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
        ...(opts.csrfToken ? { "X-CSRF-Token": opts.csrfToken } : {}),
      },
      body: hasBody ? JSON.stringify(opts.body) : undefined,
    },
  ];
}

// Re-exported so callers can type capabilities/session responses through the
// same module surface without importing types.ts directly everywhere.
export type { CapabilitiesResponse, SessionStatus };
