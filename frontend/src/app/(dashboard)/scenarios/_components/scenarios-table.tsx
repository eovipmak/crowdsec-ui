"use client";

/**
 * ScenariosTable — installed scenarios from `scenarios.list` (matrix row,
 * page mode `none`). This is a READ-ONLY config view (REQ-024): no functional
 * install/remove or enable/disable control exists (`scenarios.install` is an
 * explicitly unsupported row, architecture §5.3). Only known fields from the
 * adapter's typed shape are rendered; unknown fields are ignored (architecture
 * §7). Distinct loading / empty / error / unsupported states are shown, and
 * the caller owns capability gating so an unsupported row renders no control
 * and no fetch.
 */
import { useEffect, useState } from "react";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { isApiError } from "@/lib/api/errors";
import { CapabilityBadge } from "@/components/shared/capability-badge";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import type { CapabilityState } from "@/lib/api/capabilities";
import type { ScenarioItem, SuccessEnvelope, CollectionResult } from "@/lib/api/types";

interface ScenariosTableProps {
  capability: CapabilityState;
  fetcher: () => Promise<SuccessEnvelope<CollectionResult<ScenarioItem>>>;
  refreshKey: unknown;
}

const COLUMNS: Column<ScenarioItem>[] = [
  { key: "name", header: "Scenario" },
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

export function ScenariosTable({ capability, fetcher, refreshKey }: ScenariosTableProps) {
  const resource = useApiResource<SuccessEnvelope<CollectionResult<ScenarioItem>>>(fetcher, {
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
        <h3 className="text-sm font-semibold text-slate-900">Installed scenarios</h3>
        <CapabilityBadge state={capability} />
      </div>

      <div className="mt-3">
        {capability === "unsupported" ? (
          <p className="text-sm text-slate-500">
            Scenario listing is not supported by this installation. No control is available.
          </p>
        ) : resource.status === "loading" ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : resource.status === "error" ? (
          <div role="alert" className="flex flex-col gap-2">
            <p className="text-sm text-red-700">
              {isApiError(resource.error)
                ? resource.error.message
                : "The scenarios operation did not complete."}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => void resource.refresh()}>
                Retry
              </Button>
              <span className="font-mono text-xs text-red-600">scenarios.list</span>
            </div>
          </div>
        ) : resource.data.result.items.length === 0 ? (
          <EmptyState
            title="No scenarios installed"
            message="The current scenarios.list returned no installed scenarios."
          />
        ) : (
          <div>
            <DataTable
              columns={COLUMNS}
              rows={resource.data.result.items}
              rowKey={(row) => row.name ?? String(row.description ?? "")}
              caption="Installed CrowdSec scenarios"
            />
            {loadedAt ? (
              <p className="mt-2 text-xs text-slate-400">
                Refreshed at {loadedAt.toLocaleString()} · scenarios.list
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
