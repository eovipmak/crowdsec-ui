const API_BASE = '/api/v1'; // appended to all paths; dev proxy forwards

export class ApiError extends Error {
  constructor(
    public code: string,
    public operation: string | null,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Minimal-envelope fetch wrapper (plan §3.1). Resolves with the `result`
 * payload for success envelopes, throws ApiError for operation-level failures
 * (HTTP 200 with `{operation, error}`) and request-level failures (HTTP 4xx/5xx
 * with `{error}`).
 */
export async function apiGet<T>(
  path: string,
  params?: Record<string, string | number>,
): Promise<T> {
  const url = new URL(API_BASE + path, window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  const resp = await fetch(url, {
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
  });

  let body: any = null;
  try {
    body = await resp.json();
  } catch {
    // Non-JSON body — falls through to the request-level error path.
  }

  if (resp.ok && body && body.operation && body.result !== undefined) {
    return body.result as T;
  }
  if (resp.ok && body && body.operation && body.error) {
    throw new ApiError(body.error.code, body.operation, body.error.message);
  }

  // Request-level error (4xx/5xx) — body shape is {error: {code, message}}.
  const code = body?.error?.code ?? 'internal';
  const message = body?.error?.message ?? 'An unexpected server error occurred.';
  throw new ApiError(code, null, message);
}
