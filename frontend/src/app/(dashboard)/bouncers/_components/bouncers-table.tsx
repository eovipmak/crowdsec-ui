"use client";

/**
 * BouncersTable — registered bouncers from `bouncers.list` (matrix row, page
 * mode `none`, architecture §6.1). The bouncer token is NEVER accepted or
 * displayed (matrix §4; architecture §6.2). Only known fields are rendered;
 * unknown fields are ignored (architecture §7). Distinct loading / empty /
 * error / unsupported states are shown, and the caller owns capability
 * gating so an unsupported row renders no control and no fetch.
 */
import { useEffect, useState } from "react";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { CapabilityBadge } from "@/components/shared/capability-badge";
import { EmptyState, LoadingState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import type { CapabilityState } from "@/lib/api/capabilities";
import type { BouncerItem, SuccessEnvelope, CollectionResult } from "@/lib/api/types";

interface BouncersTableProps {
  capability: CapabilityState;
  fetcher: () => Promise<SuccessEnvelope<CollectionResult<BouncerItem>>>;
  refreshKey: unknown;
  /** True when the delete mutation is available (not unsupported). */
  canDelete: boolean;
  onDelete: (item: BouncerItem) => void;
}

const COLUMNS: Column<BouncerItem>[] = [
  {
    key: "name",
    header: "Name",
    render: (row) => row.name ?? "—",
  },
  {
    key: "type",
    header: "Type",
    hiddenOnMobile: true,
    render: (row) => row.type ?? "—",
  },
  {
    key: "ip_address",
    header: "IP address",
    hiddenOnMobile: true,
    render: (row) => row.ip_address ?? "—",
  },
  {
    key: "version",
    header: "Version",
    hiddenOnMobile: true,
    render: (row) => row.version ?? "—",
  },
  {
    key: "last_pull",
    header: "Last pull",
    hiddenOnMobile: true,
    render: (row) => (row.last_pull ? new Date(row.last_pull).toLocaleString() : "—"),
  },
];

export function BouncersTable({
  capability,
  fetcher,
  refreshKey,
  canDelete,
  onDelete,
}: BouncersTableProps) {
  const resource = useApiResource<SuccessEnvelope<CollectionResult<BouncerItem>>>(fetcher, {
    key: refreshKey,
  });
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  useEffect(() => {
    if (resource.status === "success") {
      setLoadedAt(new Date());
    }
  }, [resource.status, resource.data]);

  const items = resource.status === "success" ? resource.data.result.items : [];

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Bouncers</h2>
        <CapabilityBadge state={capability} />
      </div>

      <div className="mt-3">
        {capability === "unsupported" ? (
          <p className="text-sm text-slate-500">
            Bouncer listing is not supported by this installation. No control is available.
          </p>
        ) : resource.status === "loading" ? (
          <LoadingState label="Loading bouncers…" />
        ) : resource.status === "error" ? (
          <ErrorState
            title="Could not load bouncers"
            error={resource.error}
            onRetry={() => void resource.refresh()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            title="No bouncers registered"
            message="The current bouncers.list returned no registered bouncers."
          />
        ) : (
          <div>
            <DataTable
              columns={COLUMNS}
              rows={items}
              rowKey={(row) => row.name ?? String(row.ip_address ?? "")}
              caption="Registered CrowdSec bouncers"
              actions={
                canDelete
                  ? (item) => (
                      <Button variant="danger" size="sm" onClick={() => onDelete(item)}>
                        Delete
                      </Button>
                    )
                  : undefined
              }
            />
            {loadedAt ? (
              <p className="mt-2 text-xs text-slate-400">
                Refreshed at {loadedAt.toLocaleString()} · bouncers.list
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
