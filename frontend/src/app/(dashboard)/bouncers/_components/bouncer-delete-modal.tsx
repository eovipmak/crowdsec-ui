"use client";

/**
 * BouncerDeleteModal — `bouncers.delete` mutation (architecture §6.2).
 *
 * The matrix request field is typed: `name` (identifier). The bouncer token
 * is NEVER accepted or displayed (matrix §4; architecture §6.2). The mutation
 * goes through the two-step `useMutation` flow (confirmation issuance on
 * mount → confirmed execution) and the ConfirmationModal shows the server-
 * issued action + command_label. After success the bouncers list is
 * refreshed.
 *
 * `bouncers.delete` is capability-gated: it is only offered when
 * `capabilityFor(caps, "bouncers.delete")` is not `unsupported` AND the
 * dashboard is co-located with LAPI (matrix `bouncers.delete` row). When
 * unsupported, the page omits the delete control entirely and never mounts
 * this modal.
 */
import { useEffect } from "react";
import { useMutation } from "@/lib/hooks/use-mutation";
import { apiClient } from "@/lib/api/client";
import { ConfirmationModal } from "@/components/shared/confirmation-modal";
import type { BouncerItem } from "@/lib/api/types";

interface BouncerDeleteModalProps {
  csrfToken?: string;
  bouncer: BouncerItem;
  onClose: () => void;
  onSuccess: () => void;
}

export function BouncerDeleteModal({
  csrfToken,
  bouncer,
  onClose,
  onSuccess,
}: BouncerDeleteModalProps) {
  const mutation = useMutation();

  // Step 1: issue a server-bound confirmation token as soon as the modal opens.
  useEffect(() => {
    void mutation.issueConfirmation(() =>
      apiClient.issueConfirmation(
        { operation: "bouncers.delete", request: { name: bouncer.name } },
        csrfToken,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bouncer.name, csrfToken]);

  async function handleConfirm() {
    // Step 2: execute the confirmed mutation, then refresh the source of truth.
    const ok = await mutation.execute((token) =>
      apiClient.deleteBouncer({ name: bouncer.name }, token),
    );
    if (ok) {
      onSuccess();
      onClose();
    }
  }

  return (
    <ConfirmationModal
      open
      title="Confirm deleting bouncer"
      action={mutation.confirmation?.action ?? "Deleting a bouncer."}
      commandLabel={mutation.confirmation?.command_label}
      isPending={mutation.isPending}
      onCancel={onClose}
      onConfirm={() => void handleConfirm()}
    >
      <p className="text-sm text-slate-700">
        This permanently deletes the bouncer <strong>{bouncer.name}</strong>. Its token is not
        displayed and cannot be recovered. This action cannot be undone.
      </p>
    </ConfirmationModal>
  );
}
