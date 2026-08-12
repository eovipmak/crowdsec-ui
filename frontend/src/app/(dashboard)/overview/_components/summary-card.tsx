"use client";

/**
 * SummaryCard — a count card with a link to a detailed page, bound to one
 * approved read operation (architecture §5.1). Distinct loading / error /
 * unsupported / success states are rendered; the count is derived only from
 * the current API response, never from a local store. The caller owns
 * capability gating so an explicitly unsupported row renders no functional
 * control and no fetch (architecture §5.2/§5.3).
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { isApiError } from "@/lib/api/errors";
import { CapabilityBadge } from "@/components/shared/capability-badge";
import { Button } from "@/components/ui/button";
import type { CapabilityState } from "@/lib/api/capabilities";
import type { CollectionResult, SuccessEnvelope } from "@/lib/api/types";

interface SummaryCardProps {
  label: string;
  operation: string;
  /** Where the detailed page lives (alerts, decisions, machines). */
  href: string;
  capability: CapabilityState;
  fetcher: () => Promise<SuccessEnvelope<CollectionResult<unknown>>>;
  refreshKey: unknown;
}

export function SummaryCard({
  label,
  operation,
  href,
  capability,
  fetcher,
  refreshKey,
}: SummaryCardProps) {
  const resource = useApiResource<SuccessEnvelope<CollectionResult<unknown>>>(fetcher, {
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
            <p className="text-3xl font-semibold text-slate-900">
              {resource.data.result.items.length}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {resource.data.result.page.mode === "limit"
                ? `Showing up to ${resource.data.result.page.limit} results`
                : "Current result count"}
            </p>
            {loadedAt ? (
              <p className="mt-2 text-xs text-slate-400">
                Refreshed at {loadedAt.toLocaleString()} · {operation}
              </p>
            ) : null}
            <Link
              href={href}
              className="mt-3 inline-block text-sm font-medium text-slate-900 underline underline-offset-2 hover:text-slate-700"
            >
              View {label.toLowerCase()} →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
