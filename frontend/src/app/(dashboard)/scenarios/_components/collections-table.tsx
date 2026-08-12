"use client";

/**
 * CollectionsTable — installed collections from `collections.list` (matrix
 * row, page mode `none`). READ-ONLY (REQ-024): no functional install/remove
 * or enable/disable control exists (`collections.install` /
 * `collections.remove` are explicitly unsupported rows, architecture §5.3).
 * Only known fields are rendered; unknown fields are ignored (architecture
 * §7). Distinct loading / empty / error / unsupported states are shown, and
 * the caller owns capability gating.
 */
import { useEffect, useState } from "react";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { isApiError } from "@/lib/api/errors";
import { CapabilityBadge } from "@/components/shared/capability-badge";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import type { CapabilityState } from "@/lib/api/capabilities";
import type { CollectionItem, SuccessEnvelope, CollectionResult } from "@/lib/api/types";

interface CollectionsTableProps {
  capability: CapabilityState;
  fetcher: () => Promise<SuccessEnvelope<CollectionResult<CollectionItem>>>;
  refreshKey: unknown;
}

const COLUMNS: Column<CollectionItem>[] = [
  { key: "name", header: "Collection" },
  {
    key: "description",
    header: "Description",
    hiddenOnMobile: true,
    render: (row) => row.description ?? "—",
  },
  {
    key: "version",
    header: "Version",
    hiddenOnMobile: true,
    render: (row) => row.version ?? "—",
  },
  {
    key: "status",
    header: "Status",
    render: (row) => row.status ?? "—",
  },
];

export function CollectionsTable({ capability, fetcher, refreshKey }: CollectionsTableProps) {
  const resource = useApiResource<SuccessEnvelope<CollectionResult<CollectionItem>>>(fetcher, {
    key: refreshKey,
  });
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  useEffect(() => {
    if (resource.status === "success") {
      setLoadedAt(new Date());
    }
  }, [resource.status, resource.data]);

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">Installed collections</h3>
        <CapabilityBadge state={capability} />
      </div>

      <div className="mt-3">
        {capability === "unsupported" ? (
          <p className="text-sm text-slate-500">
            Collection listing is not supported by this installation. No control is available.
          </p>
        ) : resource.status === "loading" ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : resource.status === "error" ? (
          <div role="alert" className="flex flex-col gap-2">
            <p className="text-sm text-red-700">
              {isApiError(resource.error)
                ? resource.error.message
                : "The collections operation did not complete."}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => void resource.refresh()}>
                Retry
              </Button>
              <span className="font-mono text-xs text-red-600">collections.list</span>
            </div>
          </div>
        ) : resource.data.result.items.length === 0 ? (
          <EmptyState
            title="No collections installed"
            message="The current collections.list returned no installed collections."
          />
        ) : (
          <div>
            <DataTable
              columns={COLUMNS}
              rows={resource.data.result.items}
              rowKey={(row) => row.name ?? String(row.description ?? "")}
              caption="Installed CrowdSec collections"
            />
            {loadedAt ? (
              <p className="mt-2 text-xs text-slate-400">
                Refreshed at {loadedAt.toLocaleString()} · collections.list
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
