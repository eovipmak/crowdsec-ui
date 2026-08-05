"use client";

/**
 * Login shell (task 07).
 *
 * Authentication internals are owned by task 06; this shell implements the
 * contract surface only:
 *  - POST /api/v1/session with a single typed field {"password": "..."};
 *  - on success the server sets the session cookie and returns the session
 *    status + CSRF token (stored in memory for this page session);
 *  - 401 invalid_credentials renders an identical, non-enumerating message;
 *  - when already authenticated, redirects to /overview.
 */
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { SessionProvider, useSession } from "@/components/auth/session-provider";
import { apiClient } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { API_ERROR_CODES } from "@/lib/api/errors";
import { Field, TextInput } from "@/components/ui/forms";
import { Button } from "@/components/ui/button";
import Icon from "@/app/icon";

export function LoginForm() {
  const router = useRouter();
  const { state, refreshSession } = useSession();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (state.status === "authenticated") {
    router.replace("/overview");
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length === 0) {
      setError("Enter the administrator password to continue.");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.login({ password });
      // Re-read session status to pick up the CSRF token before navigating.
      await refreshSession();
      router.replace("/overview");
    } catch (err) {
      if (isApiError(err) && err.code === API_ERROR_CODES.INVALID_CREDENTIALS) {
        setError("Invalid username or password.");
      } else {
        setError(
          "The dashboard could not be reached. Make sure the backend is running, then try again.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="text-slate-900">
            <Icon />
          </span>
          <h1 className="text-xl font-semibold text-slate-900">CrowdSec Dashboard</h1>
          <p className="text-sm text-slate-500">Sign in to administer CrowdSec</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Administrator password" htmlFor="login-password">
            <TextInput
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              error={Boolean(error)}
            />
          </Field>

          {error ? (
            <p role="alert" className="text-sm font-medium text-red-700">
              {error}
            </p>
          ) : null}

          <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
      <p className="mt-4 text-center text-xs text-slate-500">
        Single-administrator access. CrowdSec remains the source of truth.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <SessionProvider>
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <LoginForm />
      </main>
    </SessionProvider>
  );
}
