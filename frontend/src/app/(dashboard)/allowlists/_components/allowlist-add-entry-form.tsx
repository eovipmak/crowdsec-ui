"use client";

/**
 * AllowlistAddEntryForm — `allowlists.add` mutation (architecture §6.2).
 *
 * Matrix request fields are typed: `name` (identifier), `ip_or_range`
 * (IP/CIDR), optional `expiration` (duration grammar `^[0-9]+(s|m|h|d)$`,
 * ≤365d), and optional `comment` (1–256 chars, newline-free). No CSV paths
 * or import flags are accepted (matrix §4). The mutation goes through the
 * two-step `useMutation` flow and the ConfirmationModal shows the server-
 * issued action + command_label. Unsupported / capability-gated states
 * render no functional control.
 */
import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation } from "@/lib/hooks/use-mutation";
import { apiClient } from "@/lib/api/client";
import type { CapabilityState } from "@/lib/api/capabilities";
import { CapabilityBadge } from "@/components/shared/capability-badge";
import { ConfirmationModal } from "@/components/shared/confirmation-modal";
import { OperationStatus } from "@/components/shared/operation-status";
import { toOperationStatusOutcome } from "@/app/(dashboard)/allowlists/_components/operation-outcome";
import {
  isValidDuration,
  isValidIpOrRange,
  isValidText,
} from "@/app/(dashboard)/allowlists/_components/validation";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/forms";

interface AllowlistAddEntryFormProps {
  capability: CapabilityState;
  csrfToken?: string;
  allowlistName: string;
  onSuccess: () => void;
  onResetAllowlist: () => void;
}

export function AllowlistAddEntryForm({
  capability,
  csrfToken,
  allowlistName,
  onSuccess,
  onResetAllowlist,
}: AllowlistAddEntryFormProps) {
  const [ipOrRange, setIpOrRange] = useState("");
  const [expiration, setExpiration] = useState("");
  const [comment, setComment] = useState("");
  const [fieldError, setFieldError] = useState("");
  const mutation = useMutation();

  function validate(): string | null {
    if (!ipOrRange.trim()) {
      return "IP or range is required.";
    }
    if (!isValidIpOrRange(ipOrRange)) {
      return "Enter a valid IPv4 address or IPv4 CIDR range.";
    }
    if (expiration.trim() && !isValidDuration(expiration.trim())) {
      return "Expiration must use the form 4h, 30m, 1d, etc. (max 365 days).";
    }
    if (comment.trim() && !isValidText(comment.trim())) {
      return "Comment must be 1–256 characters without line breaks.";
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
        {
          operation: "allowlists.add",
          request: buildRequest(allowlistName, ipOrRange, expiration, comment),
        },
        csrfToken,
      ),
    );
  }

  async function handleConfirm() {
    // Step 2: execute the confirmed mutation, then refresh the source of truth.
    const ok = await mutation.execute((token) =>
      apiClient.addAllowlistEntry(
        buildRequest(allowlistName, ipOrRange, expiration, comment),
        token,
      ),
    );
    if (ok) {
      onSuccess();
      setIpOrRange("");
      setExpiration("");
      setComment("");
      onResetAllowlist();
    }
  }

  if (capability === "unsupported") {
    return (
      <section className="rounded-md border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Add entry to {allowlistName}</h2>
          <CapabilityBadge state={capability} />
        </div>
        <p className="mt-3 text-sm text-slate-500">
          Adding entries is not supported by this installation. No control is available.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Add entry to {allowlistName}</h2>
        <CapabilityBadge state={capability} />
      </div>

      <OperationStatus
        outcome={toOperationStatusOutcome(mutation.outcome)}
        onRefresh={onSuccess}
        successMessage="Entry added."
      />

      <form onSubmit={handleSubmit} className="mt-4 space-y-4" aria-label="Add an allowlist entry">
        <Field
          label="IP or range"
          htmlFor="allowlist-add-ip"
          hint="A single IPv4 address or IPv4 CIDR range."
        >
          <TextInput
            id="allowlist-add-ip"
            value={ipOrRange}
            onChange={(e) => setIpOrRange(e.target.value)}
            placeholder="e.g. 198.51.100.0/24"
            required
          />
        </Field>
        <Field
          label="Expiration (optional)"
          htmlFor="allowlist-add-expiration"
          hint="e.g. 4h, 30m, 1d (max 365 days)."
        >
          <TextInput
            id="allowlist-add-expiration"
            value={expiration}
            onChange={(e) => setExpiration(e.target.value)}
            placeholder="e.g. 7d"
          />
        </Field>
        <Field label="Comment (optional)" htmlFor="allowlist-add-comment">
          <TextInput
            id="allowlist-add-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="e.g. Known scanner"
          />
        </Field>
        {fieldError ? (
          <p role="alert" className="text-xs font-medium text-red-700">
            {fieldError}
          </p>
        ) : null}
        <Button variant="primary" type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Working…" : "Add entry"}
        </Button>
      </form>

      <ConfirmationModal
        open={mutation.confirmation !== null}
        title="Confirm adding an allowlist entry"
        action={mutation.confirmation?.action ?? ""}
        commandLabel={mutation.confirmation?.command_label}
        isPending={mutation.isPending}
        onCancel={mutation.reset}
        onConfirm={() => void handleConfirm()}
      />
    </section>
  );
}

function buildRequest(name: string, ipOrRange: string, expiration: string, comment: string) {
  return {
    name: name.trim(),
    ip_or_range: ipOrRange.trim(),
    expiration: expiration.trim() || undefined,
    comment: comment.trim() || undefined,
  };
}
