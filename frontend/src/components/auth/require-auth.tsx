"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/auth/session-provider";
import { LoadingState } from "@/components/shared/states";

/**
 * Client-side guard for protected pages.
 *
 * While the initial session check runs, a spinner is shown; an unauthenticated
 * result redirects to /login; an authenticated result renders the page. The
 * server (task 05/06) remains the authority — this guard only avoids flashing
 * protected content and centralizes the redirect.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { state, isChecking } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isChecking && state.status === "unauthenticated") {
      router.replace("/login");
    }
  }, [isChecking, state.status, router]);

  if (state.status === "authenticated") {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <LoadingState label="Checking session…" />
    </div>
  );
}
