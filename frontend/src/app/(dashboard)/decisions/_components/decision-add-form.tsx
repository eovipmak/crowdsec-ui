"use client";

/**
 * DecisionAddForm — `decisions.add` mutation (architecture §6.2).
 *
 * Matrix request fields are typed: `ip_or_range` (IP/CIDR), `duration`
 * (grammar `^[0-9]+(s|m|h|d)$`, bounded ≤365d), `reason` (1–256 chars,
 * newline-free). No raw command/flag text is accepted — the browser only
 * sends typed fields. The mutation goes through the two-step `useMutation`
 * flow (confirmation issuance → confirmed execution) and the ConfirmationModal
 * shows the server-issued action + command_label. Unsupported / capability-
 * gated states render no functional control.
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

interface DecisionAddFormProps {
  capability: CapabilityState;
  csrfToken?: string;
  onSuccess: () => void;
}

const DURATION_PATTERN = "^[0-9]+(s|m|h|d)$";

export function DecisionAddForm({ capability, csrfToken, onSuccess }: DecisionAddFormProps) {
  const [ipOrRange, setIpOrRange] = useState("");
  const [duration, setDuration] = useState("");
  const [reason, setReason] = useState("");
  const [fieldError, setFieldError] = useState("");
  const mutation = useMutation();

  function validate(): string | null {
    if (!ipOrRange.trim()) {
      return "IP or range is required.";
    }
    if (!duration.trim()) {
      return "Duration is required.";
    }
    if (!new RegExp(DURATION_PATTERN).test(duration.trim())) {
      return "Duration must use the form 4h, 30m, 1d, etc.";
    }
    if (!reason.trim()) {
      return "Reason is required.";
    }
    if (reason.length > 256 || reason.includes("\n")) {
      return "Reason must be 1–256 characters without line breaks.";
    }
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) {
      setFieldError(err);
      return;
    }
    setFieldError("");
    // Step 1: issue a server-bound confirmation token (architecture §4.7).
    await mutation.issueConfirmation(() =>
      apiClient.issueConfirmation(
        { operation: "decisions.add", request: buildRequest(ipOrRange, duration, reason) },
        csrfToken,
      ),
    );
  }

  async function handleConfirm() {
    // Step 2: execute the confirmed mutation, then refresh the source of truth.
    const ok = await mutation.execute((token) =>
      apiClient.addDecision(buildRequest(ipOrRange, duration, reason), token),
    );
    if (ok) {
      onSuccess();
    }
  }

  if (capability === "unsupported") {
    return (
      <section className="rounded-md border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Add decision</h2>
          <CapabilityBadge state={capability} />
        </div>
        <p className="mt-3 text-sm text-slate-500">
          Adding decisions is not supported by this installation. No control is available.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Add decision</h2>
        <CapabilityBadge state={capability} />
      </div>

      <OperationStatus
        outcome={toOperationStatusOutcome(mutation.outcome)}
        onRefresh={onSuccess}
        successMessage="Decision added."
      />

      <form onSubmit={handleSubmit} className="mt-4 space-y-4" aria-label="Add a decision">
        <Field label="IP or range" htmlFor="decision-add-ip" hint="A single IP or CIDR range.">
          <TextInput
            id="decision-add-ip"
            value={ipOrRange}
            onChange={(e) => setIpOrRange(e.target.value)}
            placeholder="e.g. 198.51.100.7"
            required
          />
        </Field>
        <Field label="Duration" htmlFor="decision-add-duration" hint="e.g. 4h, 30m, 1d, 7d.">
          <TextInput
            id="decision-add-duration"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="e.g. 4h"
            required
          />
        </Field>
        <Field label="Reason" htmlFor="decision-add-reason">
          <TextInput
            id="decision-add-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Observed brute force"
            required
          />
        </Field>
        {fieldError ? (
          <p role="alert" className="text-xs font-medium text-red-700">
            {fieldError}
          </p>
        ) : null}
        <Button variant="primary" type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Working…" : "Add decision"}
        </Button>
      </form>

      <ConfirmationModal
        open={mutation.confirmation !== null}
        title="Confirm adding a decision"
        action={mutation.confirmation?.action ?? ""}
        commandLabel={mutation.confirmation?.command_label}
        isPending={mutation.isPending}
        onCancel={mutation.reset}
        onConfirm={() => void handleConfirm()}
      />
    </section>
  );
}

function buildRequest(ipOrRange: string, duration: string, reason: string) {
  return {
    ip_or_range: ipOrRange.trim(),
    duration: duration.trim(),
    reason: reason.trim(),
  };
}
