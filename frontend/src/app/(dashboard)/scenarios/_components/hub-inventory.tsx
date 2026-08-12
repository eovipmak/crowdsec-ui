"use client";

/**
 * HubInventory — hub inventory from `hub.list` (matrix row, page mode `none`).
 *
 * READ-ONLY (REQ-024): `hub.update` is an explicitly unsupported row
 * (architecture §5.3), so no install/update/remove control exists. The only
 * interaction is a constrained type selector whose values come from the fixed
 * `HubItem["type"]` enum (`parsers`, `postoverflows`, `scenarios`, `contexts`,
 * `appsec-configs`, `appsec-rules`, `collections`) — a typed query field, not
 * a free-form string. Only known fields are rendered.
 */
import { useEffect, useState } from "react";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { apiClient } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { CapabilityBadge } from "@/components/shared/capability-badge";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import type { CapabilityState } from "@/lib/api/capabilities";
import type { HubItem, SuccessEnvelope, CollectionResult } from "@/lib/api/types";

interface HubInventoryProps {
  capability: CapabilityState;
  refreshKey: unknown;
}

/** Fixed hub item-type enum from the matrix (architecture §6.1). */
const HUB_TYPES: HubItem["type"][] = [
  "parsers",
  "postoverflows",
  "scenarios",
  "contexts",
  "appsec-configs",
  "appsec-rules",
  "collections",
];

const COLUMNS: Column<HubItem>[] = [
  { key: "name", header: "Item" },
  {
    key: "status",
    header: "Status",
    render: (row) => row.status ?? "—",
  },
  {
    key: "version",
    header: "Version",
    hiddenOnMobile: true,
    render: (row) => row.version ?? "—",
  },
  {
    key: "type",
    header: "Type",
    hiddenOnMobile: true,
    render: (row) => row.type ?? "—",
  },
  {
    key: "description",
    header: "Description",
    render: (row) => row.description ?? "—",
  },
];

export function HubInventory({ capability, refreshKey }: HubInventoryProps) {
  const [type, setType] = useState<HubItem["type"] | "">("");
  const resource = useApiResource<SuccessEnvelope<CollectionResult<HubItem>>>(
    () => apiClient.listHub({ type: type || undefined }),
    { key: [refreshKey, type] },
  );
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  useEffect(() => {
    if (resource.status === "success") {
      setLoadedAt(new Date());
    }
  }, [resource.status, resource.data]);

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">Hub inventory</h3>
        <CapabilityBadge state={capability} />
      </div>

      <div className="mt-3">
        {capability === "unsupported" ? (
          <p className="text-sm text-slate-500">
            Hub inventory is not supported by this installation. No control is available.
          </p>
        ) : (
          <>
            <label htmlFor="hub-type-filter" className="block text-xs font-medium text-slate-600">
              Filter by item type
            </label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <select
                id="hub-type-filter"
                value={type}
                onChange={(e) => setType(e.target.value as HubItem["type"] | "")}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-2 focus:outline-offset-1 focus:outline-slate-500"
              >
                <option value="">All types</option>
                {HUB_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3">
              {resource.status === "loading" ? (
                <p className="text-sm text-slate-500">Loading…</p>
              ) : resource.status === "error" ? (
                <div role="alert" className="flex flex-col gap-2">
                  <p className="text-sm text-red-700">
                    {isApiError(resource.error)
                      ? resource.error.message
                      : "The hub operation did not complete."}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => void resource.refresh()}>
                      Retry
                    </Button>
                    <span className="font-mono text-xs text-red-600">hub.list</span>
                  </div>
                </div>
              ) : resource.data.result.items.length === 0 ? (
                <EmptyState
                  title="No hub items"
                  message="The current hub.list returned no items for the selected type."
                />
              ) : (
                <div>
                  <DataTable
                    columns={COLUMNS}
                    rows={resource.data.result.items}
                    rowKey={(row) => `${row.type ?? ""}:${row.name}`}
                    caption="CrowdSec hub inventory"
                  />
                  {loadedAt ? (
                    <p className="mt-2 text-xs text-slate-400">
                      Refreshed at {loadedAt.toLocaleString()} · hub.list
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
