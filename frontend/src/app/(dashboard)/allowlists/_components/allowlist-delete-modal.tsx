"use client";

/**
 * AllowlistDeleteModal — `allowlists.delete` mutation for a single local
 * allowlist (architecture §6.2). The matrix request field is typed: `name`
 * (identifier). Console-managed allowlists are read-only and never passed
 * here. The mutation goes through the two-step `useMutation` flow
 * (confirmation issuance on mount → confirmed execution) and the
 * ConfirmationModal shows the server-issued action + command_label. After
 * success the allowlists list is refreshed.
 */
import { useEffect } from "react";
import { useMutation } from "@/lib/hooks/use-mutation";
import { apiClient } from "@/lib/api/client";
import { ConfirmationModal } from "@/components/shared/confirmation-modal";
import type { AllowlistItem } from "@/lib/api/types";

interface AllowlistDeleteModalProps {
  csrfToken?: string;
  allowlist: AllowlistItem;
  onClose: () => void;
  onSuccess: () => void;
}

export function AllowlistDeleteModal({
  csrfToken,
  allowlist,
  onClose,
  onSuccess,
}: AllowlistDeleteModalProps) {
  const mutation = useMutation();

  // Step 1: issue a server-bound confirmation token as soon as the modal opens.
  useEffect(() => {
    void mutation.issueConfirmation(() =>
      apiClient.issueConfirmation(
        { operation: "allowlists.delete", request: { name: allowlist.name } },
        csrfToken,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowlist.name, csrfToken]);

  async function handleConfirm() {
    // Step 2: execute the confirmed mutation, then refresh the source of truth.
    const ok = await mutation.execute((token) =>
      apiClient.deleteAllowlist({ name: allowlist.name }, token),
    );
    if (ok) {
      onSuccess();
      onClose();
    }
  }

  return (
    <ConfirmationModal
      open
      title="Confirm deleting allowlist"
      action={mutation.confirmation?.action ?? "Deleting an allowlist."}
      commandLabel={mutation.confirmation?.command_label}
      isPending={mutation.isPending}
      onCancel={onClose}
      onConfirm={() => void handleConfirm()}
    >
      <p className="text-sm text-slate-700">
        This permanently deletes the allowlist <strong>{allowlist.name}</strong> and all of its
        entries. This action cannot be undone.
      </p>
    </ConfirmationModal>
  );
}
