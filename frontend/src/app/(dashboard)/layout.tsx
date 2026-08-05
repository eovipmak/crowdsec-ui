"use client";

import type { ReactNode } from "react";
import { SessionProvider } from "@/components/auth/session-provider";
import { RequireAuth } from "@/components/auth/require-auth";
import { DashboardLayout } from "@/components/layout/dashboard-layout";

/**
 * Shell for protected pages: session provider → auth guard → dashboard
 * layout. All page-specific views under /(dashboard)/ render inside this
 * shell. Stable placeholders per page (task 07); real data workflows land in
 * tasks 08–10.
 */
export default function DashboardGroupLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <RequireAuth>
        <DashboardLayout>{children}</DashboardLayout>
      </RequireAuth>
    </SessionProvider>
  );
}
