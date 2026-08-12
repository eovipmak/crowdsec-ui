"use client";

/**
 * Overview — source-of-truth CrowdSec health and current counts (REQ-021).
 *
 * Each section (alerts, decisions, machines, lapi.status, capi.status,
 * metrics.show) is fetched independently so one failure does not hide all
 * data (task 08). Data comes only from current API responses — there is no
 * local store, no real-time stream, and no monitoring-platform claim. Page
 * modes are honored: alerts/decisions are `limit`-only when capability
 * probing confirms the `-l` flag, everything else is `none` (architecture
 * §4.8). Refresh is explicit plus a single bounded poll (30s); counting uses
 * the returned current items only, never a cursor/offset/history (no
 * pagination is invented where the matrix reports `none`).
 */
import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { capabilityFor, type CapabilityState } from "@/lib/api/capabilities";
import { CapabilityBadge } from "@/components/shared/capability-badge";
import type { CapabilitiesResponse } from "@/lib/api/types";
import { PageHeader, RefreshButton } from "@/components/shared/page-header";
import { SummaryCard } from "@/app/(dashboard)/overview/_components/summary-card";
import { StatusItem } from "@/app/(dashboard)/overview/_components/status-item";
import { MetricPanel } from "@/app/(dashboard)/overview/_components/metric-panel";

const OVERVIEW_POLL_MS = 30_000;

export default function OverviewPage() {
  const caps = useApiResource<CapabilitiesResponse>(() => apiClient.getCapabilities(), {});
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  // Bounded polling: a single interval that bumps the shared refresh key so
  // every card re-fetches the current data. There is no unbounded fetching.
  useEffect(() => {
    const interval = window.setInterval(refresh, OVERVIEW_POLL_MS);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const capsData = caps.status === "success" ? caps.data : null;
  const alertsCap = capabilityFor(capsData, "alerts.list");
  const decisionsCap = capabilityFor(capsData, "decisions.list");
  const machinesCap = capabilityFor(capsData, "machines.list");
  const lapiCap = capabilityFor(capsData, "lapi.status");
  const capiCap = capabilityFor(capsData, "capi.status");
  const metricsCap = capabilityFor(capsData, "metrics.show");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="CrowdSec health and current counts from live cscli responses (REQ-021)."
        actions={<RefreshButton onClick={refresh} label="Refresh all" />}
      />

      {caps.status === "error" ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          Could not load capability information. Sections render conservatively.
        </div>
      ) : null}

      <section aria-labelledby="overview-counts">
        <h2
          id="overview-counts"
          className="text-sm font-semibold uppercase tracking-wide text-slate-500"
        >
          Current counts
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryCard
            label="Alerts"
            operation="alerts.list"
            href="/alerts"
            capability={alertsCap}
            fetcher={() => apiClient.listAlerts({ limit: 50 })}
            refreshKey={tick}
          />
          <SummaryCard
            label="Decisions"
            operation="decisions.list"
            href="/decisions"
            capability={decisionsCap}
            fetcher={() => apiClient.listDecisions({ limit: 100 })}
            refreshKey={tick}
          />
          <SummaryCard
            label="Machines"
            operation="machines.list"
            href="/machines"
            capability={machinesCap}
            fetcher={() => apiClient.listMachines()}
            refreshKey={tick}
          />
        </div>
      </section>

      <section aria-labelledby="overview-status">
        <h2
          id="overview-status"
          className="text-sm font-semibold uppercase tracking-wide text-slate-500"
        >
          Status
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatusItem
            label="LAPI status"
            operation="lapi.status"
            capability={lapiCap}
            fetcher={() => apiClient.getLapiStatus()}
            refreshKey={tick}
            pollIntervalMs={OVERVIEW_POLL_MS}
            render={(envelope) => (
              <p className="text-sm text-slate-700">
                {envelope.result.healthy === true
                  ? "Healthy"
                  : envelope.result.healthy === false
                    ? "Unhealthy"
                    : "unknown"}
              </p>
            )}
          />
          <UnsupportedAwareStatusItem
            label="CAPI status"
            operation="capi.status"
            capability={capiCap}
            pollIntervalMs={OVERVIEW_POLL_MS}
            refreshKey={tick}
          />
          <MetricPanel
            capability={metricsCap}
            fetcher={() => apiClient.showMetrics("lapi")}
            refreshKey={tick}
          />
        </div>
      </section>
    </div>
  );
}

/**
 * CAPI status card that renders an "unsupported" notice instead of a control
 * when the capability reports so (architecture §5.2/§5.3; matrix `capi.status`
 * is optional/environment-dependent).
 */
function UnsupportedAwareStatusItem({
  label,
  operation,
  capability,
  refreshKey,
  pollIntervalMs,
}: {
  label: string;
  operation: string;
  capability: CapabilityState;
  refreshKey: unknown;
  pollIntervalMs: number;
}) {
  if (capability === "unsupported") {
    return (
      <div className="rounded-md border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">{label}</h3>
          <CapabilityBadge state={capability} />
        </div>
        <p className="mt-3 text-sm text-slate-500">
          CAPI status is not supported by this installation. No control is available.
        </p>
      </div>
    );
  }
  return (
    <StatusItem
      label={label}
      operation={operation}
      capability={capability}
      fetcher={() => apiClient.getCapiStatus()}
      refreshKey={refreshKey}
      pollIntervalMs={pollIntervalMs}
      render={(envelope) => (
        <p className="text-sm text-slate-700">
          {envelope.result.enabled === true
            ? "Connected"
            : envelope.result.enabled === false
              ? "Disconnected"
              : "unknown"}
        </p>
      )}
    />
  );
}
