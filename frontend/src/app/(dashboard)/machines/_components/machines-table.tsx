"use client";

/**
 * MachinesTable — registered machines from `machines.list` (matrix row,
 * page mode `none`). Renders only known fields from the adapter's typed
 * shape; unknown fields are ignored (architecture §7). Distinct loading /
 * empty / error / unsupported states are shown, and the caller owns
 * capability gating so an explicitly unsupported row renders no functional
 * control and no fetch (architecture §5.2/§5.3).
 */
import { useEffect, useState } from "react";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { isApiError } from "@/lib/api/errors";
import { CapabilityBadge } from "@/components/shared/capability-badge";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import type { CapabilityState } from "@/lib/api/capabilities";
import type { MachineItem, SuccessEnvelope } from "@/lib/api/types";

interface MachinesTableProps {
  capability: CapabilityState;
  fetcher: () => Promise<SuccessEnvelope<{ items: MachineItem[] }>>;
  refreshKey: unknown;
}

const COLUMNS: Column<MachineItem>[] = [
  { key: "machineId", header: "Machine ID" },
  { key: "ipAddress", header: "IP address", hiddenOnMobile: true },
  {
    key: "isValidated",
    header: "Validation",
    render: (row) => (row.isValidated ? "Validated" : "Not validated"),
  },
  {
    key: "last_heartbeat",
    header: "Last heartbeat",
    hiddenOnMobile: true,
    render: (row) =>
      row.last_heartbeat ? new Date(row.last_heartbeat).toLocaleString() : "—",
  },
];

export function MachinesTable({ capability, fetcher, refreshKey }: MachinesTableProps) {
  const resource = useApiResource<SuccessEnvelope<{ items: MachineItem[] }>>(fetcher, {
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
        <h3 className="text-sm font-semibold text-slate-900">Registered machines</h3>
        <CapabilityBadge state={capability} />
      </div>

      <div className="mt-3">
        {capability === "unsupported" ? (
          <p className="text-sm text-slate-500">
            Machines listing is not supported by this installation. No control is available.
          </p>
        ) : resource.status === "loading" ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : resource.status === "error" ? (
          <div role="alert" className="flex flex-col gap-2">
            <p className="text-sm text-red-700">
              {isApiError(resource.error)
                ? resource.error.message
                : "The machines operation did not complete."}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => void resource.refresh()}>
                Retry
              </Button>
              <span className="font-mono text-xs text-red-600">machines.list</span>
            </div>
          </div>
        ) : resource.data.result.items.length === 0 ? (
          <EmptyState
            title="No machines registered"
            message="The current machines.list returned no registered machines."
          />
        ) : (
          <div>
            <DataTable
              columns={COLUMNS}
              rows={resource.data.result.items}
              rowKey={(row) => row.machineId ?? String(row.ipAddress ?? "")}
              caption="Registered CrowdSec machines"
            />
            {loadedAt ? (
              <p className="mt-2 text-xs text-slate-400">
                Refreshed at {loadedAt.toLocaleString()} · machines.list
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
