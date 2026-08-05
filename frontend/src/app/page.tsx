"use client";

import Link from "next/link";
import { SessionProvider } from "@/components/auth/session-provider";

export default function RootPage() {
  return (
    <SessionProvider>
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-6 px-6 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">CrowdSec Dashboard</h1>
        <p className="max-w-xl text-sm leading-6 text-slate-600">
          Internal single-administrator dashboard. CrowdSec is the source of truth and is accessed
          exclusively through approved <code className="rounded bg-slate-200 px-1 py-0.5">cscli</code>{" "}
          commands.
        </p>
        <div className="flex gap-3">
          <Link
            href="/login"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            Sign in
          </Link>
          <Link
            href="/overview"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            Overview
          </Link>
        </div>
      </main>
    </SessionProvider>
  );
}
