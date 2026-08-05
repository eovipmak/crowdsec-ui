"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useSession } from "@/components/auth/session-provider";
import { onSessionExpired } from "@/lib/api/client";
import Icon from "@/app/icon";

interface NavItem {
  href: string;
  label: string;
  description: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/overview", label: "Overview", description: "Status, machines, counts" },
  { href: "/alerts", label: "Alerts", description: "Searchable alert table" },
  { href: "/decisions", label: "Decisions", description: "Active decisions" },
  { href: "/machines", label: "Machines / status", description: "Registered machines and LAPI/CAPI status" },
  { href: "/scenarios", label: "Scenarios / profiles / collections", description: "Read-only configuration views" },
  { href: "/allowlists", label: "Allowlists", description: "Local allowlists" },
  { href: "/bouncers", label: "Bouncers", description: "Registered bouncers" },
];

/**
 * Authenticated application shell: sidebar navigation, session header with
 * expiry and logout, and session-expiry handling that redirects to /login.
 */
export function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state, signOut, isChecking } = useSession();
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    return onSessionExpired(() => {
      router.replace("/login");
    });
  }, [router]);

  const expiresAt = state.status === "authenticated" ? new Date(state.session.expires_at) : null;

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      router.replace("/login");
    } catch {
      // The transport already raised session-expired for 401s; if logout
      // itself failed, fall back to the login route anyway.
      router.replace("/login");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-4">
          <span className="text-slate-900">
            <Icon />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900">CrowdSec Dashboard</p>
            <p className="text-xs text-slate-500">Internal administration</p>
          </div>
        </div>
        <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-2 py-4">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
                      active ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    {item.label}
                  </Link>
                  {active ? <p className="mt-1 px-3 text-xs text-slate-400">{item.description}</p> : null}
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
          <p>Source of truth: CrowdSec via cscli</p>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:px-8">
          <p className="text-sm font-medium text-slate-700 lg:hidden">CrowdSec Dashboard</p>
          <div className="hidden lg:block" aria-hidden="true" />
          <div className="flex items-center gap-3">
            {isChecking ? (
              <span className="text-xs text-slate-400">Checking session…</span>
            ) : state.status === "authenticated" && expiresAt ? (
              <span className="text-xs text-slate-500">
                Session expires at{" "}
                <time dateTime={state.session.expires_at} className="font-medium text-slate-700">
                  {expiresAt.toLocaleString()}
                </time>
              </span>
            ) : (
              <span className="text-xs text-slate-400">Not signed in</span>
            )}
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut || state.status !== "authenticated"}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
