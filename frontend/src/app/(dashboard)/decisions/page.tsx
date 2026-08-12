"use client";

/**
 * Decisions — filterable, paginated decision administration (REQ-022) plus
 * the matrix-approved mutations `decisions.add` and `decisions.delete`
 * (architecture §6.2). `decisions.inspect` does not exist in the matrix —
 * detail stays list-based. Page mode is `limit`-only when capability
 * probing confirms the `-l` flag, otherwise the response reports `none`
 * (architecture §4.8).
 *
 * Every mutation goes through the two-step `useMutation` flow: first
 * `POST /api/v1/confirmations` issues a server-bound token, then the mutation
 * endpoint runs with that token. The ConfirmationModal shows the server-issued
 * `action` and `command_label`. After success the decisions list is re-fetched
 * (refresh of source of truth). Unsupported operations (`decisions.import`,
 * delete-by-ID, `--all`, bulk, `--origin`, `--scenario`, `--bypass-allowlist`)
 * render no functional control.
 */
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/auth/session-provider";
import { apiClient } from "@/lib/api/client";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { capabilityFor } from "@/lib/api/capabilities";
import type { CapabilitiesResponse, DecisionsListRequest } from "@/lib/api/types";
import { PageHeader, RefreshButton } from "@/components/shared/page-header";
import { DecisionsTable } from "@/app/(dashboard)/decisions/_components/decisions-table";
import { DecisionsFilters } from "@/app/(dashboard)/decisions/_components/decisions-filters";
import { DecisionAddForm } from "@/app/(dashboard)/decisions/_components/decision-add-form";
import { DecisionDeleteForm } from "@/app/(dashboard)/decisions/_components/decision-delete-form";

const DECISIONS_POLL_MS = 30_000;
const DEFAULT_LIMIT = 100;

export default function DecisionsPage() {
  const { state } = useSession();
  const csrfToken = state.status === "authenticated" ? state.session.csrf_token : undefined;

  const caps = useApiResource<CapabilitiesResponse>(() => apiClient.getCapabilities(), {});
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  // Filter/limit state is kept locally so it survives refresh (task 09).
  const [filters, setFilters] = useState<NonNullable<DecisionsListRequest["filter"]>>({});
  const [limit, setLimit] = useState(DEFAULT_LIMIT);

  useEffect(() => {
    const interval = window.setInterval(refresh, DECISIONS_POLL_MS);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const capsData = caps.status === "success" ? caps.data : null;
  const listCap = capabilityFor(capsData, "decisions.list");
  const addCap = capabilityFor(capsData, "decisions.add");
  const deleteCap = capabilityFor(capsData, "decisions.delete");

  const fetcher = useCallback(
    () => apiClient.listDecisions({ limit, filter: filters }),
    [limit, filters],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Decisions"
        description="Active decisions with list-based detail and confirmed add/delete mutations from live cscli responses (REQ-022)."
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
          <DecisionsFilters
            value={filters}
            onChange={setFilters}
            limit={limit}
            onLimitChange={setLimit}
          />
          <DecisionsTable capability={listCap} fetcher={fetcher} refreshKey={tick} />
        </div>
        <div className="space-y-6">
          <DecisionAddForm capability={addCap} csrfToken={csrfToken} onSuccess={refresh} />
          <DecisionDeleteForm capability={deleteCap} csrfToken={csrfToken} onSuccess={refresh} />
        </div>
      </div>
    </div>
  );
}
