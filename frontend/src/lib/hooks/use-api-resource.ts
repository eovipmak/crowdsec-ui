"use client";

/**
 * useApiResource — shared data-fetching primitive for the dashboard shell.
 *
 * Wraps a typed read request with loading / error / success states, an
 * explicit refresh, and optional bounded polling. No streaming, no push
 * channels, no local persistence — data freshness comes only from refresh or
 * the bounded poll interval the caller chooses (architecture §2).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { isApiError, ApiError } from "@/lib/api/errors";

export type ApiResourceState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "error"; data: null; error: ApiError }
  | { status: "success"; data: T; error: null };

export interface UseApiResourceOptions<T> {
  /** Bounded polling interval in ms; undefined/0 disables polling. */
  pollIntervalMs?: number;
  /** Re-fetch when this value changes. */
  key?: unknown;
  /** Coerce the response into the expected type (defaults to identity). */
  select?: (data: unknown) => T;
}

export function useApiResource<T>(
  fetcher: () => Promise<unknown>,
  options: UseApiResourceOptions<T> = {},
): ApiResourceState<T> & { refresh: () => Promise<void>; isRefreshing: boolean } {
  const { pollIntervalMs = 0, key, select } = options;
  const [state, setState] = useState<ApiResourceState<T>>({ status: "loading", data: null, error: null });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const raw = await fetcherRef.current();
      const data = select ? select(raw) : (raw as T);
      setState({ status: "success", data, error: null });
    } catch (err) {
      setState({
        status: "error",
        data: null,
        error: isApiError(err) ? err : new ApiError("internal", "An unexpected error occurred."),
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [select]);

  useEffect(() => {
    void run();
  }, [run, key]);

  useEffect(() => {
    if (!pollIntervalMs || pollIntervalMs <= 0) {
      return;
    }
    const interval = window.setInterval(() => {
      void run();
    }, pollIntervalMs);
    return () => window.clearInterval(interval);
  }, [pollIntervalMs, run]);

  return { ...state, refresh: run, isRefreshing };
}
