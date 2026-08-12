/**
 * Authenticated API transport (architecture §4).
 *
 * Responsibilities:
 *  - issue requests built by `apiRequests` (no free-form payloads possible);
 *  - attach the session cookie automatically (same-origin fetch) and the
 *    X-CSRF-Token header for state-changing requests;
 *  - parse the matrix envelope: HTTP 200 with either `result` (success) or
 *    `error` (operation-level failure);
 *  - normalize request-level failures (400/401/403/404/409/500/503) into
 *    ApiError;
 *  - signal expired sessions so the shell can route to /login.
 *
 * The frontend never constructs commands; every payload is typed and comes
 * from the fixed request builders.
 */
import {
  ApiError,
  API_ERROR_CODES,
  errorMessage,
  type ApiErrorCode,
  type ApiErrorShape,
} from "@/lib/api/errors";
import { apiRequests } from "@/lib/api/requests";
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
  CapiStatus,
  CollectionItem,
  CollectionResult,
  ConfirmationIssuanceRequest,
  ConfirmationIssuanceResponse,
  DecisionsAddRequest,
  DecisionsDeleteRequest,
  DecisionsListRequest,
  HealthStatus,
  HubItem,
  HubListRequest,
  LapiStatus,
  LoginRequest,
  LogoutResponse,
  MachineItem,
  MachinesPruneRequest,
  MetricsComponent,
  MutationEnvelope,
  MutationOperationId,
  ProfileItem,
  ScenarioItem,
  ScenariosInspectRequest,
  SessionResponse,
  SimulationStatus,
  SuccessEnvelope,
} from "@/lib/api/types";

const SESSION_EXPIRED_EVENT = "crowdsec-dashboard:session-expired";

/**
 * Listen for session-expiry signals raised by the transport. The auth shell
 * (SessionProvider) subscribes so it can transition to the unauthenticated
 * state and redirect to /login.
 */
export function onSessionExpired(handler: () => void): () => void {
  window.addEventListener(SESSION_EXPIRED_EVENT, handler);
  return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handler);
}

function notifySessionExpired(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
}

/** Raise the session-expired event once per 401 burst to avoid redirect loops. */
let sessionExpiredNotified = false;
function handleUnauthenticated(): void {
  if (!sessionExpiredNotified) {
    sessionExpiredNotified = true;
    notifySessionExpired();
  }
}

// Reset the guard whenever a request succeeds so a later expiry is raised again.
function resetSessionExpiredGuard(): void {
  sessionExpiredNotified = false;
}

interface EnvelopeLike {
  operation?: unknown;
  result?: unknown;
  error?: ApiErrorShape;
  session?: unknown;
  confirmation?: unknown;
  capabilities?: unknown;
  status?: unknown;
  service?: unknown;
  version?: unknown;
  time?: unknown;
}

/**
 * Execute a typed request and decode the response envelope.
 * - 2xx: returns the JSON body.
 * - 200 matrix envelope with `error`: throws ApiError (operation-level).
 * - non-2xx: throws ApiError with the request-level code.
 * - 401 unauthenticated: raises the session-expired event before throwing.
 */
async function execute<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: {
      ...(init.headers ?? {}),
      Accept: "application/json",
    },
  });

  let body: EnvelopeLike | null = null;
  const text = await response.text();
  if (text) {
    try {
      body = JSON.parse(text) as EnvelopeLike;
    } catch {
      body = null;
    }
  }

  if (response.status === 401 && body?.error?.code === API_ERROR_CODES.UNAUTHENTICATED) {
    handleUnauthenticated();
  } else if (response.ok) {
    resetSessionExpiredGuard();
  }

  if (!response.ok) {
    const code = (body?.error?.code as ApiErrorCode) ?? requestLevelCode(response.status);
    const message = errorMessage(code, body?.error?.message);
    throw new ApiError(code, message, {
      retryable: body?.error?.retryable ?? false,
      isRequestLevel: true,
      httpStatus: response.status,
    });
  }

  // A 200 with an error field is an operation-level (adapter) failure.
  if (body && "error" in body && body.error) {
    const code = (body.error.code as ApiErrorCode) ?? API_ERROR_CODES.CROWDSEC_FAILURE;
    throw new ApiError(code, errorMessage(code, body.error.message), {
      retryable: body.error.retryable ?? false,
      isRequestLevel: false,
      httpStatus: 200,
    });
  }

  if (body === null) {
    throw new ApiError(API_ERROR_CODES.INTERNAL, "The server returned an empty response.", {
      isRequestLevel: true,
      httpStatus: response.status,
    });
  }

  return body as unknown as T;
}

function requestLevelCode(status: number): ApiErrorCode {
  switch (status) {
    case 400:
      return API_ERROR_CODES.INVALID_PARAMETERS;
    case 401:
      return API_ERROR_CODES.UNAUTHENTICATED;
    case 403:
      return API_ERROR_CODES.CSRF_FAILED;
    case 404:
      return API_ERROR_CODES.NOT_FOUND;
    case 405:
      return API_ERROR_CODES.METHOD_NOT_ALLOWED;
    case 409:
      return API_ERROR_CODES.INVALID_CONFIRMATION;
    case 503:
      return API_ERROR_CODES.UNAVAILABLE;
    default:
      return API_ERROR_CODES.INTERNAL;
  }
}

export interface ApiClient {
  // application routes
  getHealth(): Promise<HealthStatus>;
  login(req: LoginRequest): Promise<SessionResponse>;
  getSessionStatus(): Promise<SessionResponse>;
  logout(csrfToken?: string): Promise<LogoutResponse>;
  getCapabilities(): Promise<CapabilitiesResponse>;
  issueConfirmation(
    req: ConfirmationIssuanceRequest,
    csrfToken?: string,
  ): Promise<ConfirmationIssuanceResponse>;

  // alerts
  listAlerts(
    req: AlertsListRequest,
  ): Promise<SuccessEnvelope<CollectionResult<import("@/lib/api/types").AlertItem>>>;
  inspectAlert(req: AlertsInspectRequest): Promise<SuccessEnvelope<unknown>>;

  // decisions
  listDecisions(
    req: DecisionsListRequest,
  ): Promise<SuccessEnvelope<CollectionResult<import("@/lib/api/types").DecisionItem>>>;
  addDecision(
    req: DecisionsAddRequest,
    csrfToken?: string,
  ): Promise<MutationEnvelope<"decisions.add">>;
  deleteDecision(
    req: DecisionsDeleteRequest,
    csrfToken?: string,
  ): Promise<MutationEnvelope<"decisions.delete">>;

  // machines
  listMachines(): Promise<SuccessEnvelope<CollectionResult<MachineItem>>>;
  pruneMachines(
    req: MachinesPruneRequest,
    csrfToken?: string,
  ): Promise<MutationEnvelope<"machines.prune">>;

  // bouncers
  listBouncers(): Promise<SuccessEnvelope<CollectionResult<import("@/lib/api/types").BouncerItem>>>;
  deleteBouncer(
    req: BouncersDeleteRequest,
    csrfToken?: string,
  ): Promise<MutationEnvelope<"bouncers.delete">>;

  // hub / scenarios / collections / profiles
  listHub(req: HubListRequest): Promise<SuccessEnvelope<CollectionResult<HubItem>>>;
  listScenarios(): Promise<SuccessEnvelope<CollectionResult<ScenarioItem>>>;
  inspectScenario(req: ScenariosInspectRequest): Promise<SuccessEnvelope<unknown>>;
  listCollections(): Promise<SuccessEnvelope<CollectionResult<CollectionItem>>>;
  inspectProfiles(): Promise<SuccessEnvelope<CollectionResult<ProfileItem>>>;

  // simulation / status
  getSimulationStatus(): Promise<SuccessEnvelope<SimulationStatus>>;
  getLapiStatus(): Promise<SuccessEnvelope<LapiStatus>>;
  getCapiStatus(): Promise<SuccessEnvelope<CapiStatus>>;

  // allowlists
  listAllowlists(): Promise<
    SuccessEnvelope<CollectionResult<import("@/lib/api/types").AllowlistItem>>
  >;
  checkAllowlist(req: AllowlistsCheckRequest): Promise<SuccessEnvelope<unknown>>;
  createAllowlist(
    req: AllowlistsCreateRequest,
    csrfToken?: string,
  ): Promise<MutationEnvelope<"allowlists.create">>;
  addAllowlistEntry(
    req: AllowlistsAddRequest,
    csrfToken?: string,
  ): Promise<MutationEnvelope<"allowlists.add">>;
  removeAllowlistEntry(
    req: AllowlistsRemoveRequest,
    csrfToken?: string,
  ): Promise<MutationEnvelope<"allowlists.remove">>;
  deleteAllowlist(
    req: AllowlistsDeleteRequest,
    csrfToken?: string,
  ): Promise<MutationEnvelope<"allowlists.delete">>;

  // metrics
  showMetrics(component: MetricsComponent): Promise<SuccessEnvelope<unknown>>;
}

function run<T>(request: [string, RequestInit]): Promise<T> {
  return execute<T>(request[0], request[1]);
}

export const apiClient: ApiClient = {
  getHealth: () => run(apiRequests.health()),
  login: (req) => run(apiRequests.login(req)),
  getSessionStatus: () => run(apiRequests.sessionStatus()),
  logout: (csrfToken) => run(apiRequests.logout({ csrfToken })),
  getCapabilities: () => run(apiRequests.capabilities()),
  issueConfirmation: (req, csrfToken) => run(apiRequests.issueConfirmation(req, { csrfToken })),

  listAlerts: (req) => run(apiRequests.alertsList(req)),
  inspectAlert: (req) => run(apiRequests.alertsInspect(req)),
  listDecisions: (req) => run(apiRequests.decisionsList(req)),
  addDecision: (req, csrfToken) => run(apiRequests.decisionsAdd(req, { csrfToken })),
  deleteDecision: (req, csrfToken) => run(apiRequests.decisionsDelete(req, { csrfToken })),

  listMachines: () => run(apiRequests.machinesList()),
  pruneMachines: (req, csrfToken) => run(apiRequests.machinesPrune(req, { csrfToken })),

  listBouncers: () => run(apiRequests.bouncersList()),
  deleteBouncer: (req, csrfToken) => run(apiRequests.bouncersDelete(req, { csrfToken })),

  listHub: (req) => run(apiRequests.hubList(req)),
  listScenarios: () => run(apiRequests.scenariosList()),
  inspectScenario: (req) => run(apiRequests.scenariosInspect(req)),
  listCollections: () => run(apiRequests.collectionsList()),
  inspectProfiles: () => run(apiRequests.profilesInspect()),

  getSimulationStatus: () => run(apiRequests.simulationStatus()),
  getLapiStatus: () => run(apiRequests.lapiStatus()),
  getCapiStatus: () => run(apiRequests.capiStatus()),

  listAllowlists: () => run(apiRequests.allowlistsList()),
  checkAllowlist: (req) => run(apiRequests.allowlistsCheck(req)),
  createAllowlist: (req, csrfToken) => run(apiRequests.allowlistsCreate(req, { csrfToken })),
  addAllowlistEntry: (req, csrfToken) => run(apiRequests.allowlistsAdd(req, { csrfToken })),
  removeAllowlistEntry: (req, csrfToken) => run(apiRequests.allowlistsRemove(req, { csrfToken })),
  deleteAllowlist: (req, csrfToken) => run(apiRequests.allowlistsDelete(req, { csrfToken })),

  showMetrics: (component) => run(apiRequests.metricsShow(component)),
};

export type { MutationOperationId };
