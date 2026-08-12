"use client";

/**
 * AllowlistCreateForm — `allowlists.create` mutation (architecture §6.2).
 *
 * Matrix request fields are typed: `name` (identifier matching
 * `^[A-Za-z0-9][A-Za-z0-9_./:-]{0,255}$`) and `description` (1–256 chars,
 * newline-free, required by `cscli` 1.7.8). No raw command/flag text is
 * accepted — the browser only sends typed fields. The mutation goes through
 * the two-step `useMutation` flow (confirmation issuance → confirmed
 * execution) and the ConfirmationModal shows the server-issued action +
 * command_label. Unsupported / capability-gated states render no functional
 * control.
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
import { isValidName, isValidText } from "@/app/(dashboard)/allowlists/_components/validation";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/forms";

interface AllowlistCreateFormProps {
  capability: CapabilityState;
  csrfToken?: string;
  onSuccess: () => void;
}

export function AllowlistCreateForm({
  capability,
  csrfToken,
  onSuccess,
}: AllowlistCreateFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fieldError, setFieldError] = useState("");
  const mutation = useMutation();

  function validate(): string | null {
    if (!name.trim()) {
      return "A name is required.";
    }
    if (!isValidName(name.trim())) {
      return "Name must start with a letter or digit and contain only A–Z, a–z, 0–9, _. / : - (max 256 chars).";
    }
    if (!description.trim()) {
      return "A description is required.";
    }
    if (!isValidText(description.trim())) {
      return "Description must be 1–256 characters without line breaks.";
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
        { operation: "allowlists.create", request: buildRequest(name, description) },
        csrfToken,
      ),
    );
  }

  async function handleConfirm() {
    // Step 2: execute the confirmed mutation, then refresh the source of truth.
    const ok = await mutation.execute((token) =>
      apiClient.createAllowlist(buildRequest(name, description), token),
    );
    if (ok) {
      onSuccess();
      setName("");
      setDescription("");
    }
  }

  if (capability === "unsupported") {
    return (
      <section className="rounded-md border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Create allowlist</h2>
          <CapabilityBadge state={capability} />
        </div>
        <p className="mt-3 text-sm text-slate-500">
          Creating allowlists is not supported by this installation. No control is available.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Create allowlist</h2>
        <CapabilityBadge state={capability} />
      </div>

      <OperationStatus
        outcome={toOperationStatusOutcome(mutation.outcome)}
        onRefresh={onSuccess}
        successMessage="Allowlist created."
      />

      <form onSubmit={handleSubmit} className="mt-4 space-y-4" aria-label="Create an allowlist">
        <Field
          label="Name"
          htmlFor="allowlist-create-name"
          hint="Letters, digits, and _ . / : - (max 256 chars)."
        >
          <TextInput
            id="allowlist-create-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. honeypots"
            required
          />
        </Field>
        <Field label="Description" htmlFor="allowlist-create-description">
          <TextInput
            id="allowlist-create-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Internal honeypot ranges"
            required
          />
        </Field>
        {fieldError ? (
          <p role="alert" className="text-xs font-medium text-red-700">
            {fieldError}
          </p>
        ) : null}
        <Button variant="primary" type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Working…" : "Create allowlist"}
        </Button>
      </form>

      <ConfirmationModal
        open={mutation.confirmation !== null}
        title="Confirm creating allowlist"
        action={mutation.confirmation?.action ?? ""}
        commandLabel={mutation.confirmation?.command_label}
        isPending={mutation.isPending}
        onCancel={mutation.reset}
        onConfirm={() => void handleConfirm()}
      />
    </section>
  );
}

function buildRequest(name: string, description: string) {
  return {
    name: name.trim(),
    description: description.trim(),
  };
}
