"use client";

/**
 * MetricPanel — optional statistics panel for `metrics.show` (architecture
 * §5.1, matrix `metrics.show`). Metrics are ordinary CrowdSec data, not
 * Prometheus/Grafana, and the matrix marks them optional/environment-
 * dependent. This panel therefore renders only the approved `lapi` component
 * and labels the result honestly:
 *   - `unsupported` capability → no fetch, "Unavailable" notice, no control.
 *   - operation failure → distinct error state with a retry control.
 *   - success → shows the section keys and their numeric counts (the only
 *     stable, known rendering); an empty/absent numeric payload is labelled
 *     "No metrics available" rather than invented into a chart.
 */
import { useEffect, useState } from "react";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { isApiError } from "@/lib/api/errors";
import { CapabilityBadge } from "@/components/shared/capability-badge";
import { Button } from "@/components/ui/button";
import type { CapabilityState } from "@/lib/api/capabilities";
import type { SuccessEnvelope } from "@/lib/api/types";

interface MetricPanelProps {
  capability: CapabilityState;
  fetcher: () => Promise<SuccessEnvelope<unknown>>;
  refreshKey: unknown;
}

/** Extract numeric leaf counts from a section object (known stable rendering). */
function numericCounts(value: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (value === null || typeof value !== "object") {
    return out;
  }
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "number") {
      out[key] = v;
    }
  }
  return out;
}

export function MetricPanel({ capability, fetcher, refreshKey }: MetricPanelProps) {
  const resource = useApiResource<SuccessEnvelope<unknown>>(fetcher, { key: refreshKey });
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  useEffect(() => {
    if (resource.status === "success") {
      setLoadedAt(new Date());
    }
  }, [resource.status, resource.data]);

  const counts = resource.status === "success" ? numericCounts(resource.data.result) : null;
  const hasCounts = counts !== null && Object.keys(counts).length > 0;

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">Statistics (metrics.show)</h3>
        <CapabilityBadge state={capability} />
      </div>

      <div className="mt-3">
        {capability === "unsupported" ? (
          <p className="text-sm text-slate-500">
            Metrics are not supported by this CrowdSec installation. No chart is available.
          </p>
        ) : resource.status === "loading" ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : resource.status === "error" ? (
          <div role="alert" className="flex flex-col gap-2">
            <p className="text-sm text-red-700">
              {isApiError(resource.error)
                ? resource.error.message
                : "The metrics operation did not complete."}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => void resource.refresh()}>
                Retry
              </Button>
              <span className="font-mono text-xs text-red-600">metrics.show</span>
            </div>
          </div>
        ) : hasCounts ? (
          <div>
            <dl className="grid grid-cols-2 gap-2">
              {Object.entries(counts).map(([key, value]) => (
                <div key={key} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                  <dt className="text-xs text-slate-500">{key}</dt>
                  <dd className="text-lg font-semibold text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
            {loadedAt ? (
              <p className="mt-2 text-xs text-slate-400">
                Refreshed at {loadedAt.toLocaleString()} · metrics.show (lapi)
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            No metrics available. History and charts are not rendered because the CrowdSec metrics
            payload is empty or unsupported.
          </p>
        )}
      </div>
    </div>
  );
}
