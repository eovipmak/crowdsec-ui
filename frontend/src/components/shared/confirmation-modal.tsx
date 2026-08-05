"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface ConfirmationModalProps {
  open: boolean;
  title: string;
  /** Human-readable description of the CrowdSec action (from the confirmation service). */
  action: string;
  /** Fixed operation label from the matrix (informational only). */
  commandLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
  /** True while the server is processing the mutation. */
  isPending?: boolean;
  /** Optional context body rendered above the action. */
  children?: ReactNode;
}

/**
 * Mutation confirmation dialog.
 *
 * The modal renders the server-issued confirmation details (action +
 * command_label) returned by POST /api/v1/confirmations. The token itself is
 * never displayed — it is opaque and bound server-side to the operation and
 * the typed request.
 */
export function ConfirmationModal({
  open,
  title,
  action,
  commandLabel,
  onCancel,
  onConfirm,
  isPending = false,
  children,
}: ConfirmationModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isPending) {
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, isPending, onCancel]);

  if (!open) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmation-title"
      aria-describedby="confirmation-description"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-slate-900/50" onClick={isPending ? undefined : onCancel} />
      <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 id="confirmation-title" className="text-lg font-semibold text-slate-900">
          {title}
        </h2>
        <div id="confirmation-description" className="mt-3 space-y-2 text-sm text-slate-700">
          <p>{action}</p>
          {commandLabel ? (
            <p className="text-xs text-slate-500">
              Corresponding CrowdSec action: <code className="rounded bg-slate-100 px-1 py-0.5">{commandLabel}</code>
            </p>
          ) : null}
          {children ? <div className="pt-1">{children}</div> : null}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={isPending}>
            {isPending ? "Working…" : "Confirm"}
          </Button>
        </div>
      </div>
    </div>
  );
}
