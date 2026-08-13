"use client";

/**
 * AlertsTable — alerts from `alerts.list` (matrix row). Renders only known
 * fields from the adapter's typed shape; unknown fields are ignored
 * (architecture §7). Distinct loading / empty / error / unsupported states
 * are shown, and the caller owns capability gating so an explicitly
 * unsupported row renders no functional control and no fetch (§5.2/§5.3).
 *
 * Page mode is honored: `limit` mode shows the informational "showing up to
 * N" note (offset is unsupported, so there is no next-page fetch), and any
 * other mode renders no page controls (architecture §4.8).
 */
import { useEffect, useState } from "react";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import type { AlertItem, CollectionResult, SuccessEnvelope } from "@/lib/api/types";
import type { CapabilityState } from "@/lib/api/capabilities";
import { CapabilityBadge } from "@/components/shared/capability-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";

interface AlertsTableProps {
  capability: CapabilityState;
  fetcher: () => Promise<SuccessEnvelope<CollectionResult<AlertItem>>>;
  refreshKey: unknown;
  onSelect: (id: number) => void;
}

const COLUMNS: Column<AlertItem>[] = [
  { key: "id", header: "ID" },
  {
    key: "value",
    header: "Value",
    render: (row) => {
      const value = row.value || "";
      if (row.scope) {
        return value ? `${row.scope}:${value}` : row.scope;
      }
      return value || "—";
    },
  },
  {
    key: "reason",
    header: "Reason",
    render: (row) => row.reason || row.scenario || "—",
  },
  {
    key: "country",
    header: "Country",
    hiddenOnMobile: true,
    render: (row) => row.country || "—",
  },
  {
    key: "as",
    header: "AS",
    hiddenOnMobile: true,
    render: (row) => {
      const parts = [row.as_number, row.as_name].filter((p) => p && p.trim() !== "");
      return parts.length > 0 ? parts.join(" ") : "—";
    },
  },
  {
    key: "decisions",
    header: "Decisions",
    hiddenOnMobile: true,
    render: (row) =>
      row.decisions && row.decisions.length > 0
        ? row.decisions.map((d) => `${d.type}${d.duration ? ` (${d.duration})` : ""}`).join(", ")
        : "—",
  },
  {
    key: "created_at",
    header: "Created",
    hiddenOnMobile: true,
    render: (row) =>
      row.created_at ? new Date(row.created_at).toLocaleString() : formatStartAt(row),
  },
  {
    key: "kind",
    header: "Kind",
    hiddenOnMobile: true,
    render: (row) => row.kind || "—",
  },
  {
    key: "machine",
    header: "Machine",
    hiddenOnMobile: true,
    render: (row) => row.machine || "—",
  },
];

function formatStartAt(row: AlertItem): string {
  return row.start_at ? new Date(row.start_at).toLocaleString() : "—";
}

export function AlertsTable({ capability, fetcher, refreshKey, onSelect }: AlertsTableProps) {
  const resource = useApiResource<SuccessEnvelope<CollectionResult<AlertItem>>>(fetcher, {
    key: refreshKey,
  });
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  useEffect(() => {
    if (resource.status === "success") {
      setLoadedAt(new Date());
    }
  }, [resource.status, resource.data]);

  const page = resource.status === "success" ? resource.data.result.page : null;

  return (
    <section
      aria-labelledby="alerts-table-heading"
      className="rounded-md border border-slate-200 bg-white p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="alerts-table-heading" className="text-sm font-semibold text-slate-900">
          Alerts
        </h2>
        <CapabilityBadge state={capability} />
      </div>

      <div className="mt-3">
        {capability === "unsupported" ? (
          <p className="text-sm text-slate-500">
            Alerts listing is not supported by this installation. No control is available.
          </p>
        ) : resource.status === "loading" ? (
          <LoadingState label="Loading alerts…" />
        ) : resource.status === "error" ? (
          <ErrorState
            title="Could not load alerts"
            error={resource.error}
            onRetry={() => void resource.refresh()}
          />
        ) : resource.data.result.items.length === 0 ? (
          <EmptyState
            title="No alerts match"
            message="The current alerts.list returned no alerts for the selected filters."
          />
        ) : (
          <div>
            <DataTable
              columns={COLUMNS}
              rows={resource.data.result.items}
              rowKey={(row) => String(row.id)}
              caption="CrowdSec alerts"
              actions={(row) => (
                <Button variant="secondary" size="sm" onClick={() => onSelect(row.id)}>
                  View
                </Button>
              )}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
              {page && page.mode === "limit" ? (
                <p className="text-xs text-slate-500">
                  Showing up to {page.limit ?? "—"} results
                  {page.has_more
                    ? " — more results exist; this installation does not support paging past this point."
                    : "."}
                </p>
              ) : (
                <span />
              )}
              <p className="text-xs text-slate-400">
                {loadedAt ? `Refreshed at ${loadedAt.toLocaleString()}` : ""} · alerts.list
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
