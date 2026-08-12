"use client";

/**
 * StatusItem — a self-contained status card bound to one approved read
 * operation (architecture §5.1). It fetches lazily, renders distinct
 * loading / error / success states, and honors the operation's capability:
 * an explicitly `unsupported` row renders no functional control and no fetch
 * (architecture §5.2/§5.3). The caller owns capability gating so the hook is
 * never mounted for an unsupported row.
 */
import { useEffect, useState, type ReactNode } from "react";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { isApiError } from "@/lib/api/errors";
import { CapabilityBadge } from "@/components/shared/capability-badge";
import { Button } from "@/components/ui/button";
import type { CapabilityState } from "@/lib/api/capabilities";
import type { SuccessEnvelope } from "@/lib/api/types";

interface StatusItemProps<T> {
  label: string;
  operation: string;
  capability: CapabilityState;
  fetcher: () => Promise<SuccessEnvelope<T>>;
  /** Re-fetch when this changes (bounded poll + explicit refresh + capability change). */
  refreshKey: unknown;
  pollIntervalMs?: number;
  render: (envelope: SuccessEnvelope<T>) => ReactNode;
}

export function StatusItem<T>({
  label,
  operation,
  capability,
  fetcher,
  refreshKey,
  pollIntervalMs = 0,
  render,
}: StatusItemProps<T>) {
  const resource = useApiResource<SuccessEnvelope<T>>(fetcher, {
    key: refreshKey,
    pollIntervalMs,
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
        <h3 className="text-sm font-semibold text-slate-900">{label}</h3>
        <CapabilityBadge state={capability} />
      </div>
      <div className="mt-3">
        {resource.status === "loading" ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : resource.status === "error" ? (
          <div role="alert" className="flex flex-col gap-2">
            <p className="text-sm text-red-700">
              {isApiError(resource.error)
                ? resource.error.message
                : "The operation did not complete."}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => void resource.refresh()}>
                Retry
              </Button>
              <span className="font-mono text-xs text-red-600">{operation}</span>
            </div>
          </div>
        ) : (
          <div>
            {render(resource.data)}
            {loadedAt ? (
              <p className="mt-2 text-xs text-slate-400">
                Refreshed at {loadedAt.toLocaleString()} · {operation}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
