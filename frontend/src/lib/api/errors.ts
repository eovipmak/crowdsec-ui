/**
 * Safe user-facing fallback messages keyed by error code — mirrors
 * backend/errors.py SAFE_MESSAGES (plan §3.2). Server-provided messages are
 * always preferred; this table is only reached when a code is unknown or the
 * response carried no message.
 */
const FALLBACKS: Record<string, string> = {
  invalid_parameters: 'The request parameters are invalid.',
  not_found: 'The requested resource was not found.',
  method_not_allowed: 'This request method is not allowed.',
  internal: 'An unexpected server error occurred.',
  crowdsec_failure: 'The CrowdSec command failed.',
  timeout: 'The CrowdSec command timed out.',
  unavailable: 'The CrowdSec command is not available.',
  permission_denied: 'CrowdSec denied permission to run the command.',
  malformed_output: 'CrowdSec returned malformed output.',
  unsupported: 'This operation is not supported.',
};

export function messageFor(code: string): string {
  return FALLBACKS[code] ?? 'An unexpected error occurred.';
}
