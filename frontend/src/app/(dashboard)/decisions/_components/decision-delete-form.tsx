"use client";

/**
 * DecisionDeleteForm — `decisions.delete` mutation (architecture §6.2).
 *
 * The matrix request field is typed: `ip_or_range` (IP/CIDR). There is no
 * delete-by-ID, `--all`, bulk delete, `--origin`, `--scenario`, or
 * `--bypass-allowlist` behavior — the UI only sends the typed IP/range. The
 * mutation goes through the two-step `useMutation` flow and requires explicit
 * confirmation (REQ-027). After success the decisions list is refreshed.
 * Unsupported / capability-gated states render no functional control.
 */
import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation } from "@/lib/hooks/use-mutation";
import { apiClient } from "@/lib/api/client";
import type { CapabilityState } from "@/lib/api/capabilities";
import { CapabilityBadge } from "@/components/shared/capability-badge";
import { ConfirmationModal } from "@/components/shared/confirmation-modal";
import { OperationStatus } from "@/components/shared/operation-status";
import { toOperationStatusOutcome } from "@/app/(dashboard)/decisions/_components/operation-outcome";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/forms";

interface DecisionDeleteFormProps {
  capability: CapabilityState;
  csrfToken?: string;
  onSuccess: () => void;
}

export function DecisionDeleteForm({ capability, csrfToken, onSuccess }: DecisionDeleteFormProps) {
  const [ipOrRange, setIpOrRange] = useState("");
  const [fieldError, setFieldError] = useState("");
  const mutation = useMutation();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ipOrRange.trim()) {
      setFieldError("IP or range is required.");
      return;
    }
    setFieldError("");
    // Step 1: issue a server-bound confirmation token (architecture §4.7).
    await mutation.issueConfirmation(() =>
      apiClient.issueConfirmation(
        { operation: "decisions.delete", request: { ip_or_range: ipOrRange.trim() } },
        csrfToken,
      ),
    );
  }

  async function handleConfirm() {
    // Step 2: execute the confirmed mutation, then refresh the source of truth.
    const ok = await mutation.execute((token) =>
      apiClient.deleteDecision({ ip_or_range: ipOrRange.trim() }, token),
    );
    if (ok) {
      onSuccess();
    }
  }

  if (capability === "unsupported") {
    return (
      <section className="rounded-md border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Delete decision</h2>
          <CapabilityBadge state={capability} />
        </div>
        <p className="mt-3 text-sm text-slate-500">
          Deleting decisions is not supported by this installation. No control is available.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Delete decision</h2>
        <CapabilityBadge state={capability} />
      </div>

      <OperationStatus
        outcome={toOperationStatusOutcome(mutation.outcome)}
        onRefresh={onSuccess}
        successMessage="Decision deleted."
      />

      <form onSubmit={handleSubmit} className="mt-4 space-y-4" aria-label="Delete a decision">
        <Field
          label="IP or range"
          htmlFor="decision-delete-ip"
          hint="Deletes decisions matching this IP or range."
        >
          <TextInput
            id="decision-delete-ip"
            value={ipOrRange}
            onChange={(e) => setIpOrRange(e.target.value)}
            placeholder="e.g. 198.51.100.7"
            required
          />
        </Field>
        {fieldError ? (
          <p role="alert" className="text-xs font-medium text-red-700">
            {fieldError}
          </p>
        ) : null}
        <Button variant="danger" type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Working…" : "Delete decision"}
        </Button>
      </form>

      <ConfirmationModal
        open={mutation.confirmation !== null}
        title="Confirm deleting decision"
        action={mutation.confirmation?.action ?? ""}
        commandLabel={mutation.confirmation?.command_label}
        isPending={mutation.isPending}
        onCancel={mutation.reset}
        onConfirm={() => void handleConfirm()}
      />
    </section>
  );
}
