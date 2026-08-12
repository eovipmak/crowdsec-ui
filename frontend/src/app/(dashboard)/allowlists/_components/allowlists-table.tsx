"use client";

/**
 * AllowlistsTable — allowlists from `allowlists.list` (matrix row, page mode
 * `none`, architecture §6.1). Each allowlist is expanded to show its local /
 * console-managed entries. Console-managed entries (`source` set) are
 * read-only — they carry no mutation controls (matrix §4 `allowlists.list`).
 * Only known fields are rendered; unknown fields are ignored (architecture
 * §7). Distinct loading / empty / error / unsupported states are shown, and
 * the caller owns capability gating so an unsupported row renders no control
 * and no fetch.
 */
import { useEffect, useState } from "react";
import { useApiResource } from "@/lib/hooks/use-api-resource";
// TEMP: unused isApiError import removed for task-11 e2e verification
import { CapabilityBadge } from "@/components/shared/capability-badge";
import { EmptyState, LoadingState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import type { CapabilityState } from "@/lib/api/capabilities";
import type {
  AllowlistItem,
  AllowlistEntry,
  SuccessEnvelope,
  CollectionResult,
} from "@/lib/api/types";

interface AllowlistsTableProps {
  capability: CapabilityState;
  fetcher: () => Promise<SuccessEnvelope<CollectionResult<AllowlistItem>>>;
  refreshKey: unknown;
  /** True when the delete mutation is available (not unsupported). */
  canDelete: boolean;
  onDelete: (item: AllowlistItem) => void;
  onAddEntry: (item: AllowlistItem) => void;
  onRemoveEntry: (item: AllowlistItem, entry: AllowlistEntry) => void;
}

const ENTRY_COLUMNS: Column<AllowlistEntry>[] = [
  {
    key: "ip",
    header: "IP / range",
    render: (row) => row.ip ?? "—",
  },
  {
    key: "comment",
    header: "Comment",
    hiddenOnMobile: true,
    render: (row) => row.comment ?? "—",
  },
  {
    key: "expiration",
    header: "Expiration",
    hiddenOnMobile: true,
    render: (row) => (row.expiration ? new Date(row.expiration).toLocaleString() : "—"),
  },
  {
    key: "source",
    header: "Source",
    render: (row) => (row.source ? getSourceLabel(row.source) : "Local"),
  },
];

function getSourceLabel(source: string): string {
  const s = source.toLowerCase();
  if (s.includes("console")) {
    return "Console-managed";
  }
  return source;
}

export function AllowlistsTable({
  capability,
  fetcher,
  refreshKey,
  canDelete,
  onDelete,
  onAddEntry,
  onRemoveEntry,
}: AllowlistsTableProps) {
  const resource = useApiResource<SuccessEnvelope<CollectionResult<AllowlistItem>>>(fetcher, {
    key: refreshKey,
  });
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  useEffect(() => {
    if (resource.status === "success") {
      setLoadedAt(new Date());
    }
  }, [resource.status, resource.data]);

  const items = resource.status === "success" ? resource.data.result.items : [];

  const allowlistColumns: Column<AllowlistItem>[] = [
    {
      key: "name",
      header: "Allowlist",
      render: (row) => (
        <span className="font-medium text-slate-900">
          {row.name}
          {row.source ? (
            <span className="ml-2 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/20">
              {getSourceLabel(row.source)}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: "description",
      header: "Description",
      hiddenOnMobile: true,
      render: (row) => row.description ?? "—",
    },
    {
      key: "entries",
      header: "Entries",
      render: (row) => String(row.entries?.length ?? 0),
    },
  ];

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Allowlists</h2>
        <CapabilityBadge state={capability} />
      </div>

      <div className="mt-3">
        {capability === "unsupported" ? (
          <p className="text-sm text-slate-500">
            Allowlist listing is not supported by this installation. No control is available.
          </p>
        ) : resource.status === "loading" ? (
          <LoadingState label="Loading allowlists…" />
        ) : resource.status === "error" ? (
          <ErrorState
            title="Could not load allowlists"
            error={resource.error}
            onRetry={() => void resource.refresh()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            title="No allowlists"
            message="The current allowlists.list returned no allowlists."
          />
        ) : (
          <div>
            {items.map((item) => (
              <AllowlistCard
                key={item.name}
                item={item}
                columns={allowlistColumns}
                canDelete={canDelete}
                onDelete={() => onDelete(item)}
                onAddEntry={() => onAddEntry(item)}
                onRemoveEntry={(entry) => onRemoveEntry(item, entry)}
              />
            ))}
            {loadedAt ? (
              <p className="mt-2 text-xs text-slate-400">
                Refreshed at {loadedAt.toLocaleString()} · allowlists.list
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function AllowlistCard({
  item,
  columns,
  canDelete,
  onDelete,
  onAddEntry,
  onRemoveEntry,
}: {
  item: AllowlistItem;
  columns: Column<AllowlistItem>[];
  canDelete: boolean;
  onDelete: () => void;
  onAddEntry: () => void;
  onRemoveEntry: (entry: AllowlistEntry) => void;
}) {
  const readonly = Boolean(item.source);
  const entries = item.entries ?? [];

  return (
    <div className="mb-4 rounded-md border border-slate-200 bg-slate-50/50 p-3">
      <DataTable
        columns={columns}
        rows={[item]}
        rowKey={() => item.name}
        caption={`${item.name} allowlist`}
      />
      <div className="mt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Entries</h3>
          {!readonly && !canDelete ? (
            <span className="text-xs text-slate-400">
              Entry editing requires the matching allowlist mutation capability.
            </span>
          ) : null}
        </div>
        <div className="mt-2">
          {entries.length === 0 ? (
            <p className="text-sm text-slate-500">No entries.</p>
          ) : (
            <DataTable
              columns={ENTRY_COLUMNS}
              rows={entries}
              rowKey={(e) => `${e.ip}:${e.comment ?? ""}`}
              caption={`${item.name} entries`}
              actions={
                readonly || !canDelete
                  ? undefined
                  : (entry) => (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onRemoveEntry(entry)}
                        disabled={readonly}
                      >
                        Remove
                      </Button>
                    )
              }
            />
          )}
        </div>
        {!readonly ? (
          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={onAddEntry}>
              Add entry
            </Button>
            {canDelete ? (
              <Button variant="danger" size="sm" onClick={onDelete}>
                Delete allowlist
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-500">
            Console-managed allowlists are read-only. No mutation controls are available.
          </p>
        )}
      </div>
    </div>
  );
}
