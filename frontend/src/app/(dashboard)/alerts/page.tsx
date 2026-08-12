"use client";

/**
 * Alerts — searchable, filterable, paginated alert table with detail views
 * (REQ-022). Data comes only from `alerts.list` / `alerts.inspect` (matrix
 * rows). Page mode is `limit`-only when capability probing confirms the `-l`
 * flag, otherwise the response reports `none` and no page controls render
 * (architecture §4.8). Refresh is explicit plus a single bounded poll.
 *
 * Unsupported operations (`alerts.delete`, …) render no functional control,
 * and no command/flag string is ever constructed by the browser — requests
 * are built from typed filter fields only.
 */
import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { capabilityFor } from "@/lib/api/capabilities";
import type { AlertsListRequest, CapabilitiesResponse } from "@/lib/api/types";
import { PageHeader, RefreshButton } from "@/components/shared/page-header";
import { AlertsTable } from "@/app/(dashboard)/alerts/_components/alerts-table";
import { AlertsFilters } from "@/app/(dashboard)/alerts/_components/alerts-filters";
import { AlertDetail } from "@/app/(dashboard)/alerts/_components/alert-detail";

const ALERTS_POLL_MS = 30_000;
const DEFAULT_LIMIT = 50;

export default function AlertsPage() {
  const caps = useApiResource<CapabilitiesResponse>(() => apiClient.getCapabilities(), {});
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  // Filter/pagination state is kept locally so it survives refresh and detail
  // navigation within the page (task 09; no persistence beyond the page).
  const [filters, setFilters] = useState<NonNullable<AlertsListRequest["filter"]>>({});
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    const interval = window.setInterval(refresh, ALERTS_POLL_MS);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const capsData = caps.status === "success" ? caps.data : null;
  const alertsCap = capabilityFor(capsData, "alerts.list");
  const inspectCap = capabilityFor(capsData, "alerts.inspect");

  const fetcher = useCallback(
    () => apiClient.listAlerts({ limit, filter: filters }),
    [limit, filters],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alerts"
        description="Searchable, filterable, paginated alert table with detail views from live cscli responses (REQ-022)."
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

      <AlertsFilters value={filters} onChange={setFilters} limit={limit} onLimitChange={setLimit} />

      <AlertsTable
        capability={alertsCap}
        fetcher={fetcher}
        refreshKey={tick}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      {selectedId !== null ? (
        <AlertDetail id={selectedId} capability={inspectCap} onClose={() => setSelectedId(null)} />
      ) : null}
    </div>
  );
}
