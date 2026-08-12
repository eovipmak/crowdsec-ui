"use client";

/**
 * Bouncers — registered bouncers with conditional local deletion
 * (`bouncers.delete`) only when capability probing permits it (REQ-025).
 *
 * `bouncers.list` is a read (page mode `none`, architecture §6.1). The bouncer
 * token is NEVER accepted or displayed (matrix §4; architecture §6.2).
 * `bouncers.add` is an explicitly unsupported row and renders no control
 * (matrix §5.3). `bouncers.delete` is capability-gated: it is only offered
 * when `capabilityFor(caps, "bouncers.delete")` is not `unsupported` AND the
 * dashboard is co-located with LAPI; otherwise the delete control is omitted
 * entirely and a CapabilityBadge notice is shown instead.
 *
 * Every mutation goes through the two-step `useMutation` flow: first
 * `POST /api/v1/confirmations` issues a server-bound token, then the mutation
 * endpoint runs with that token. The ConfirmationModal shows the server-
 * issued `action` + `command_label`. Refresh is explicit plus a single
 * bounded 30s poll with cleanup on unmount — there is no unbounded
 * fetching and no local store.
 */
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/auth/session-provider";
import { apiClient } from "@/lib/api/client";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { capabilityFor } from "@/lib/api/capabilities";
import type { BouncerItem, CapabilitiesResponse } from "@/lib/api/types";
import { PageHeader, RefreshButton } from "@/components/shared/page-header";
import { CapabilityBadge } from "@/components/shared/capability-badge";
import { BouncersTable } from "@/app/(dashboard)/bouncers/_components/bouncers-table";
import { BouncerDeleteModal } from "@/app/(dashboard)/bouncers/_components/bouncer-delete-modal";

const BOUNCERS_POLL_MS = 30_000;

export default function BouncersPage() {
  const { state } = useSession();
  const csrfToken = state.status === "authenticated" ? state.session.csrf_token : undefined;

  const caps = useApiResource<CapabilitiesResponse>(() => apiClient.getCapabilities(), {});
  const [tick, setTick] = useState(0);
  const [deleting, setDeleting] = useState<BouncerItem | null>(null);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const interval = window.setInterval(refresh, BOUNCERS_POLL_MS);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const capsData = caps.status === "success" ? caps.data : null;
  const listCap = capabilityFor(capsData, "bouncers.list");
  const deleteCap = capabilityFor(capsData, "bouncers.delete");
  const canDelete = deleteCap !== "unsupported";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bouncers"
        description="Registered bouncers from live cscli responses; local deletion only when capability probing permits (REQ-025)."
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

      <BouncersTable
        capability={listCap}
        fetcher={() => apiClient.listBouncers()}
        refreshKey={tick}
        canDelete={canDelete}
        onDelete={(item) => setDeleting(item)}
      />

      {canDelete ? null : (
        <section
          aria-labelledby="bouncers-delete-capability"
          className="rounded-md border border-slate-200 bg-white p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 id="bouncers-delete-capability" className="text-sm font-semibold text-slate-900">
              Delete bouncer
            </h2>
            <CapabilityBadge state={deleteCap} />
          </div>
          <p className="mt-3 text-sm text-slate-500">
            Bouncer deletion is not supported by this installation. The dashboard must be co-located
            with the Local API (LAPI) and the command must be available. No control is available.
            The bouncer token is never accepted or displayed.
          </p>
        </section>
      )}

      {deleting && canDelete ? (
        <BouncerDeleteModal
          csrfToken={csrfToken}
          bouncer={deleting}
          onClose={() => setDeleting(null)}
          onSuccess={refresh}
        />
      ) : null}
    </div>
  );
}
