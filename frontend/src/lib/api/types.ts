/**
 * Wire envelope types — mirrors backend/envelope.py + backend/errors.py exactly
 * (plan §3.1 / §3.2). String values of the error codes are part of the wire
 * contract and MUST NOT drift from backend/errors.py.
 */

export type SuccessEnvelope<T> = { operation: string; result: T };
export type OperationErrorEnvelope = {
  operation: string;
  error: { code: string; message: string };
};
export type RequestErrorEnvelope = { error: { code: string; message: string } };

// Request-level codes (HTTP 4xx/5xx).
export const INVALID_PARAMETERS = 'invalid_parameters';
export const NOT_FOUND = 'not_found';
export const METHOD_NOT_ALLOWED = 'method_not_allowed';
export const INTERNAL = 'internal';

// Operation-level codes (HTTP 200, always safe message).
export const CROWDSEC_FAILURE = 'crowdsec_failure';
export const TIMEOUT = 'timeout';
export const UNAVAILABLE = 'unavailable';
export const PERMISSION_DENIED = 'permission_denied';
export const MALFORMED_OUTPUT = 'malformed_output';
export const UNSUPPORTED = 'unsupported';
