"use client";

/**
 * AllowlistRemoveEntryModal — `allowlists.remove` mutation for a single entry
 * (architecture §6.2). The matrix request fields are typed: `name` (identifier)
 * and `ip_or_range` (IP/CIDR). Console-managed entries are read-only and the
 * caller never passes them here. The mutation goes through the two-step
 * `useMutation` flow (confirmation issuance on mount → confirmed execution)
 * and the ConfirmationModal shows the server-issued action + command_label.
 * After success the allowlists list is refreshed.
 */
import { useEffect } from "react";
import { useMutation } from "@/lib/hooks/use-mutation";
import { apiClient } from "@/lib/api/client";
import { ConfirmationModal } from "@/components/shared/confirmation-modal";
import type { AllowlistItem, AllowlistEntry } from "@/lib/api/types";

interface AllowlistRemoveEntryModalProps {
  csrfToken?: string;
  allowlist: AllowlistItem;
  entry: AllowlistEntry;
  onClose: () => void;
  onSuccess: () => void;
}

export function AllowlistRemoveEntryModal({
  csrfToken,
  allowlist,
  entry,
  onClose,
  onSuccess,
}: AllowlistRemoveEntryModalProps) {
  void csrfToken; // TEMP: lint-clean stub for task-11 e2e verification
  const mutation = useMutation();

  // Step 1: issue a server-bound confirmation token as soon as the modal opens.
  useEffect(() => {
    void mutation.issueConfirmation(() =>
      apiClient.issueConfirmation(
        {
          operation: "allowlists.remove",
          request: { name: allowlist.name, ip_or_range: entry.ip },
        },
        csrfToken,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowlist.name, entry.ip, csrfToken]);

  async function handleConfirm() {
    // Step 2: execute the confirmed mutation, then refresh the source of truth.
    const ok = await mutation.execute((token) =>
      apiClient.removeAllowlistEntry({ name: allowlist.name, ip_or_range: entry.ip }, token),
    );
    if (ok) {
      onSuccess();
      onClose();
    }
  }

  return (
    <ConfirmationModal
      open
      title="Confirm removing an allowlist entry"
      action={mutation.confirmation?.action ?? "Removing an allowlist entry."}
      commandLabel={mutation.confirmation?.command_label}
      isPending={mutation.isPending}
      onCancel={onClose}
      onConfirm={() => void handleConfirm()}
    />
  );
}
