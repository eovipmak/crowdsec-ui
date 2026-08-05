/**
 * Error handling for the dashboard API client.
 *
 * All failures are normalized into ApiError instances with a stable machine
 * code and a safe, renderable message. Codes come from the architecture
 * contract (§4.4 status table and §4.5 error classes); messages never contain
 * secrets, tokens, hashes, or raw command output (REQ-063).
 */

export const API_ERROR_CODES = {
  INVALID_PARAMETERS: "invalid_parameters",
  CONFIRMATION_REQUIRED: "confirmation_required",
  UNAUTHENTICATED: "unauthenticated",
  INVALID_CREDENTIALS: "invalid_credentials",
  CSRF_FAILED: "csrf_failed",
  NOT_FOUND: "not_found",
  METHOD_NOT_ALLOWED: "method_not_allowed",
  INVALID_CONFIRMATION: "invalid_confirmation",
  INTERNAL: "internal",
  UNAVAILABLE: "unavailable",
  PERMISSION_DENIED: "permission_denied",
  TIMEOUT: "timeout",
  UNSUPPORTED: "unsupported",
  MALFORMED_OUTPUT: "malformed_output",
  CROWDSEC_FAILURE: "crowdsec_failure",
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

/** Adapter/request error classes that may be carried inside a 200 matrix envelope. */
export type OperationErrorCode = Exclude<
  ApiErrorCode,
  "confirmation_required" | "csrf_failed" | "method_not_allowed"
>;

export interface ApiErrorShape {
  code: ApiErrorCode;
  message: string;
  retryable?: boolean;
}

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly retryable: boolean;
  /** True when the failure was a request-level problem (HTTP 4xx/5xx), false for operation-level (HTTP 200) failures. */
  readonly isRequestLevel: boolean;
  readonly httpStatus: number | null;

  constructor(
    code: ApiErrorCode,
    message: string,
    options: { retryable?: boolean; isRequestLevel?: boolean; httpStatus?: number | null } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.isRequestLevel = options.isRequestLevel ?? false;
    this.httpStatus = options.httpStatus ?? null;
  }
}

const FALLBACK_MESSAGES: Record<ApiErrorCode, string> = {
  invalid_parameters: "The request parameters are invalid.",
  confirmation_required: "This action requires confirmation.",
  unauthenticated: "Your session has expired. Please sign in again.",
  invalid_credentials: "Invalid username or password.",
  csrf_failed: "The security token for this action is invalid. Refresh the page and try again.",
  not_found: "The requested item was not found.",
  method_not_allowed: "This request is not allowed.",
  invalid_confirmation: "The confirmation does not match this request.",
  internal: "An unexpected server error occurred.",
  unavailable: "CrowdSec command-line tools are unavailable.",
  permission_denied: "The dashboard does not have permission to perform this operation.",
  timeout: "The operation timed out. Try again.",
  unsupported: "This CrowdSec installation does not support the requested operation.",
  malformed_output: "CrowdSec returned unexpected output.",
  crowdsec_failure: "CrowdSec rejected the requested operation.",
};

export function errorMessage(code: ApiErrorCode, serverMessage?: string): string {
  if (serverMessage && serverMessage.trim().length > 0) {
    return serverMessage;
  }
  return FALLBACK_MESSAGES[code] ?? FALLBACK_MESSAGES.internal;
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}
