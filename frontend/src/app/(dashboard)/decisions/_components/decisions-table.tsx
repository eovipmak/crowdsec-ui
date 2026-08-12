"use client";

/**
 * DecisionsTable — decisions from `decisions.list` (matrix row). Detail is
 * list-based only — `decisions.inspect` does not exist in the matrix, so no
 * detail navigation is rendered. Renders only known fields; unknown fields
 * are ignored (architecture §7). Distinct loading / empty / error /
 * unsupported states are shown.
 *
 * Page mode is honored: `limit` mode shows the informational "showing up to
 * N" note (offset is unsupported, so there is no next-page fetch), and any
 * other mode renders no page controls (architecture §4.8).
 */
import { useEffect, useState } from "react";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import type { CollectionResult, DecisionItem, SuccessEnvelope } from "@/lib/api/types";
import type { CapabilityState } from "@/lib/api/capabilities";
import { CapabilityBadge } from "@/components/shared/capability-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { DataTable, type Column } from "@/components/ui/data-table";

interface DecisionsTableProps {
  capability: CapabilityState;
  fetcher: () => Promise<SuccessEnvelope<CollectionResult<DecisionItem>>>;
  refreshKey: unknown;
}

const COLUMNS: Column<DecisionItem>[] = [
  { key: "id", header: "ID" },
  {
    key: "value",
    header: "IP / value",
    render: (row) => row.value || "—",
  },
  {
    key: "scope",
    header: "Scope",
    hiddenOnMobile: true,
    render: (row) => row.scope || "—",
  },
  {
    key: "type",
    header: "Type",
    render: (row) => row.type || "—",
  },
  {
    key: "origin",
    header: "Origin",
    hiddenOnMobile: true,
    render: (row) => row.origin || "—",
  },
  {
    key: "scenario",
    header: "Scenario",
    hiddenOnMobile: true,
    render: (row) => row.scenario || "—",
  },
  {
    key: "until",
    header: "Until",
    hiddenOnMobile: true,
    render: (row) => (row.until ? new Date(row.until).toLocaleString() : row.duration || "—"),
  },
];

export function DecisionsTable({ capability, fetcher, refreshKey }: DecisionsTableProps) {
  const resource = useApiResource<SuccessEnvelope<CollectionResult<DecisionItem>>>(fetcher, {
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
      aria-labelledby="decisions-table-heading"
      className="rounded-md border border-slate-200 bg-white p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="decisions-table-heading" className="text-sm font-semibold text-slate-900">
          Decisions
        </h2>
        <CapabilityBadge state={capability} />
      </div>

      <div className="mt-3">
        {capability === "unsupported" ? (
          <p className="text-sm text-slate-500">
            Decisions listing is not supported by this installation. No control is available.
          </p>
        ) : resource.status === "loading" ? (
          <LoadingState label="Loading decisions…" />
        ) : resource.status === "error" ? (
          <ErrorState
            title="Could not load decisions"
            error={resource.error}
            onRetry={() => void resource.refresh()}
          />
        ) : resource.data.result.items.length === 0 ? (
          <EmptyState
            title="No decisions match"
            message="The current decisions.list returned no decisions for the selected filters."
          />
        ) : (
          <div>
            <DataTable
              columns={COLUMNS}
              rows={resource.data.result.items}
              rowKey={(row) => String(row.id)}
              caption="CrowdSec active decisions"
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
                {loadedAt ? `Refreshed at ${loadedAt.toLocaleString()}` : ""} · decisions.list
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
