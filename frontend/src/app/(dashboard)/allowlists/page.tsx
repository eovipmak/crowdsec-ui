"use client";

/**
 * Allowlists — allowlist display and typed local mutations
 * (`allowlists.create/add/remove/delete`) per the command matrix (REQ-025;
 * architecture §6.1/§6.2). `allowlists.list` and `allowlists.check` are reads
 * (page mode `none`); every mutation is confirmed and refreshes the source of
 * truth. Console-managed entries are read-only. `allowlists.import` is
 * explicitly unsupported and renders no control (matrix §4; architecture
 * §5.3).
 *
 * Every mutation goes through the two-step `useMutation` flow: first
 * `POST /api/v1/confirmations` issues a server-bound token, then the mutation
 * endpoint runs with that token. The ConfirmationModal shows the server-issued
 * `action` + `command_label`. Inputs are validated client-side against the
 * matrix §3 rules before posting.
 */
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/auth/session-provider";
import { apiClient } from "@/lib/api/client";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { capabilityFor } from "@/lib/api/capabilities";
import type { CapabilitiesResponse } from "@/lib/api/types";
import { PageHeader, RefreshButton } from "@/components/shared/page-header";
import { AllowlistsTable } from "@/app/(dashboard)/allowlists/_components/allowlists-table";
import { AllowlistCreateForm } from "@/app/(dashboard)/allowlists/_components/allowlist-create-form";
import { AllowlistAddEntryForm } from "@/app/(dashboard)/allowlists/_components/allowlist-add-entry-form";
import { AllowlistDeleteModal } from "@/app/(dashboard)/allowlists/_components/allowlist-delete-modal";
import { AllowlistRemoveEntryModal } from "@/app/(dashboard)/allowlists/_components/allowlist-remove-entry-modal";
import { AllowlistCheckCard } from "@/app/(dashboard)/allowlists/_components/allowlist-check-card";
import type { AllowlistItem, AllowlistEntry } from "@/lib/api/types";

const ALLOWLISTS_POLL_MS = 30_000;

export default function AllowlistsPage() {
  const { state } = useSession();
  const csrfToken = state.status === "authenticated" ? state.session.csrf_token : undefined;

  const caps = useApiResource<CapabilitiesResponse>(() => apiClient.getCapabilities(), {});
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const interval = window.setInterval(refresh, ALLOWLISTS_POLL_MS);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const capsData = caps.status === "success" ? caps.data : null;
  const listCap = capabilityFor(capsData, "allowlists.list");
  const checkCap = capabilityFor(capsData, "allowlists.check");
  const createCap = capabilityFor(capsData, "allowlists.create");
  const addCap = capabilityFor(capsData, "allowlists.add");
  const removeCap = capabilityFor(capsData, "allowlists.remove");
  const deleteCap = capabilityFor(capsData, "allowlists.delete");

  // Entry/delete controls render only when the relevant mutations are usable.
  const canMutate =
    addCap !== "unsupported" && removeCap !== "unsupported" && deleteCap !== "unsupported";

  // Selection state for the add-entry / remove-entry / delete flows.
  const [addingTo, setAddingTo] = useState<AllowlistItem | null>(null);
  const [deleting, setDeleting] = useState<AllowlistItem | null>(null);
  const [removing, setRemoving] = useState<{
    allowlist: AllowlistItem;
    entry: AllowlistEntry;
  } | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Allowlists"
        description="Local allowlists with typed create/add/remove/delete mutations from live cscli responses (REQ-025)."
        actions={<RefreshButton onClick={refresh} label="Refresh" />}
      />

      {caps.status === "error" ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          Could not load capability information. Sections render conservatively.
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <AllowlistsTable
            capability={listCap}
            fetcher={() => apiClient.listAllowlists()}
            refreshKey={tick}
            canDelete={canMutate}
            onDelete={(item) => setDeleting(item)}
            onAddEntry={(item) => setAddingTo(item)}
            onRemoveEntry={(item, entry) => setRemoving({ allowlist: item, entry })}
          />
        </div>
        <div className="space-y-6">
          <AllowlistCheckCard capability={checkCap} />
          <AllowlistCreateForm capability={createCap} csrfToken={csrfToken} onSuccess={refresh} />
        </div>
      </div>

      {addingTo && !addingTo.source ? (
        <AllowlistAddEntryForm
          capability={addCap}
          csrfToken={csrfToken}
          allowlistName={addingTo.name}
          onSuccess={refresh}
          onResetAllowlist={() => setAddingTo(null)}
        />
      ) : null}

      {deleting && !deleting.source ? (
        <AllowlistDeleteModal
          csrfToken={csrfToken}
          allowlist={deleting}
          onClose={() => setDeleting(null)}
          onSuccess={refresh}
        />
      ) : null}

      {removing && !removing.allowlist.source ? (
        <AllowlistRemoveEntryModal
          csrfToken={csrfToken}
          allowlist={removing.allowlist}
          entry={removing.entry}
          onClose={() => setRemoving(null)}
          onSuccess={refresh}
        />
      ) : null}
    </div>
  );
}
