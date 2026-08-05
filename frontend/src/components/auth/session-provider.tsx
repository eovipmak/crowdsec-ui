"use client";

import type { SessionStatus } from "@/lib/api/types";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api/client";
import { API_ERROR_CODES, type ApiError } from "@/lib/api/errors";

export type SessionState =
  | { status: "checking" }
  | { status: "authenticated"; session: SessionStatus }
  | { status: "unauthenticated" };

interface SessionContextValue {
  state: SessionState;
  /** Re-check session state against the server. */
  refreshSession: () => Promise<void>;
  /** Log out server-side and update local state. */
  signOut: () => Promise<void>;
  /** True while the initial session check is in flight. */
  isChecking: boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: "checking" });
  const [isChecking, setIsChecking] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const response = await apiClient.getSessionStatus();
      setState({ status: "authenticated", session: response.session });
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError && apiError.code === API_ERROR_CODES.UNAUTHENTICATED) {
        setState({ status: "unauthenticated" });
      } else {
        // A transient network/server failure must not log the user out;
        // keep the previous state and surface the error to the caller.
        setState((prev) => (prev.status === "checking" ? { status: "unauthenticated" } : prev));
        throw err;
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refreshSession();
      } catch {
        // Handled inside refreshSession; the effect only needs to stop the spinner.
      } finally {
        if (!cancelled) {
          setIsChecking(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshSession]);

  const signOut = useCallback(async () => {
    // DELETE /session is CSRF-protected; use the CSRF token from the last
    // session status when available.
    const csrfToken = state.status === "authenticated" ? state.session.csrf_token : undefined;
    try {
      await apiClient.logout(csrfToken);
    } catch (err) {
      const apiError = err as ApiError;
      // 401 unauthenticated means the session already expired server-side;
      // there is nothing left to invalidate locally.
      if (!apiError || apiError.code !== API_ERROR_CODES.UNAUTHENTICATED) {
        throw err;
      }
    } finally {
      setState({ status: "unauthenticated" });
    }
  }, [state]);

  const value = useMemo(
    () => ({ state, refreshSession, signOut, isChecking }),
    [state, refreshSession, signOut, isChecking],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return ctx;
}
