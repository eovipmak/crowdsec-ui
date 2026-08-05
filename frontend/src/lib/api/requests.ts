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
  HubListRequest,
  LoginRequest,
  MachinesPruneRequest,
  MetricsComponent,
  ScenariosInspectRequest,
  SessionStatus,
} from "@/lib/api/types";

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
  issueConfirmation: (req: ConfirmationIssuanceRequest, opts: HttpOptions = {}): [string, RequestInit] =>
    post("/confirmations", req, { csrfToken: opts.csrfToken }),

  // --- alerts ---
  alertsList: (req: AlertsListRequest) => get("/alerts", { limit: req.limit, ...req.filter }),
  alertsInspect: (req: AlertsInspectRequest) => get(`/alerts/${req.id}`),

  // --- decisions ---
  decisionsList: (req: DecisionsListRequest) => get("/decisions", { limit: req.limit, ...req.filter }),
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
    post("/machines/prune", { operation: "machines.prune", request: req }, { csrfToken: opts.csrfToken }),

  // --- bouncers ---
  bouncersList: () => get("/bouncers"),
  bouncersDelete: (req: BouncersDeleteRequest, opts: HttpOptions = {}): [string, RequestInit] =>
    del("/bouncers", { body: { operation: "bouncers.delete", request: req }, csrfToken: opts.csrfToken }),

  // --- hub / scenarios / collections / profiles ---
  hubList: (req: HubListRequest) => get("/hub", { type: req.type }),
  scenariosList: () => get("/scenarios"),
  scenariosInspect: (req: ScenariosInspectRequest) => get(`/scenarios/${req.scenario}`),
  collectionsList: () => get("/collections"),
  profilesInspect: () => get("/profiles"),

  // --- simulation / status ---
  simulationStatus: () => get("/simulation"),
  lapiStatus: () => get("/status/lapi"),
  capiStatus: () => get("/status/capi"),

  // --- allowlists ---
  allowlistsList: () => get("/allowlists"),
  allowlistsCheck: (req: AllowlistsCheckRequest) => get("/allowlists/check", { ip_or_range: req.ip_or_range }),
  allowlistsCreate: (req: AllowlistsCreateRequest, opts: HttpOptions = {}): [string, RequestInit] =>
    post("/allowlists", { operation: "allowlists.create", request: req }, { csrfToken: opts.csrfToken }),
  allowlistsAdd: (req: AllowlistsAddRequest, opts: HttpOptions = {}): [string, RequestInit] =>
    post("/allowlists/entries", { operation: "allowlists.add", request: req }, { csrfToken: opts.csrfToken }),
  allowlistsRemove: (req: AllowlistsRemoveRequest, opts: HttpOptions = {}): [string, RequestInit] =>
    del("/allowlists/entries", {
      body: { operation: "allowlists.remove", request: req },
      csrfToken: opts.csrfToken,
    }),
  allowlistsDelete: (req: AllowlistsDeleteRequest, opts: HttpOptions = {}): [string, RequestInit] =>
    del("/allowlists", { body: { operation: "allowlists.delete", request: req }, csrfToken: opts.csrfToken }),

  // --- metrics ---
  metricsShow: (component: MetricsComponent) => get(`/metrics/${component}`),
} as const;

// ---------------------------------------------------------------------------
// Low-level helpers (internal)
// ---------------------------------------------------------------------------

interface QueryValue {
  [key: string]: string | number | undefined;
}

function get(path: string, query?: QueryValue): [string, RequestInit] {
  const url = new URL(API_BASE + path, "http://localhost"); // relative base; see client
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") {
        url.searchParams.append(key, String(value));
      }
    }
  }
  return [url.pathname + url.search, { method: "GET" }];
}

function post(
  path: string,
  body: unknown,
  opts: { csrfToken?: string } = {},
): [string, RequestInit] {
  return [
    path,
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
  return [
    path,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...(opts.csrfToken ? { "X-CSRF-Token": opts.csrfToken } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    },
  ];
}

// Re-exported so callers can type capabilities/session responses through the
// same module surface without importing types.ts directly everywhere.
export type { CapabilitiesResponse, SessionStatus };
