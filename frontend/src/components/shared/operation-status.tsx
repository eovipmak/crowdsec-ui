"use client";

import { useState } from "react";
import type { OperationError } from "@/lib/api/types";
import { Button } from "@/components/ui/button";

interface OperationStatusProps {
  /** Null/undefined means no operation has completed yet. */
  outcome?: { ok: boolean; error?: OperationError } | null;
  /** Optional refresh action shown after a failure. */
  onRefresh?: () => void;
  successMessage?: string;
}

/**
 * Operation-result status banner for mutations: readable success confirmation
 * or a secret-safe failure with a refresh control so the administrator can
 * respond (REQ-028).
 */
export function OperationStatus({
  outcome,
  onRefresh,
  successMessage = "Operation completed.",
}: OperationStatusProps) {
  const [dismissed, setDismissed] = useState(false);

  if (!outcome || dismissed) {
    return null;
  }

  if (outcome.ok) {
    return (
      <div
        role="status"
        className="flex items-start justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
      >
        <p className="font-medium">{successMessage}</p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-xs font-medium text-emerald-700 underline hover:text-emerald-900"
        >
          Dismiss
        </button>
      </div>
    );
  }

  const error = outcome.error;
  return (
    <div
      role="alert"
      className="flex items-start justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3"
    >
      <div className="text-sm text-red-800">
        <p className="font-medium">The operation did not complete.</p>
        <p className="mt-0.5 text-red-700">{error?.message ?? "An unexpected error occurred."}</p>
        {error ? (
          <p className="mt-0.5 font-mono text-xs text-red-600">
            Code: {error.code}
            {error.retryable ? " · retryable" : ""}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {onRefresh ? (
          <Button variant="secondary" size="sm" onClick={onRefresh}>
            Refresh
          </Button>
        ) : null}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-xs font-medium text-red-700 underline hover:text-red-900"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
