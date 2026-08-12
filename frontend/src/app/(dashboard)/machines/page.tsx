"use client";

/**
 * Machines / status — registered machines and LAPI/CAPI status (REQ-023).
 *
 * All sections (`machines.list`, `lapi.status`, `capi.status`) are fetched
 * independently so one failure does not hide the rest. Page mode is `none`
 * for every operation here (architecture §5.1), so no pagination, cursor, or
 * offset controls are rendered. CAPI status is optional/environment-
 * dependent and is rendered as an explicit unsupported notice when the
 * capability reports so (architecture §5.2). Refresh is explicit plus a
 * single bounded poll; there is no unbounded fetching.
 *
 * Note: `machines.prune` (mutation) is capability-gated and out of scope for
 * this read-only ownership slice; it is not rendered here.
 */
import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { capabilityFor, type CapabilityState } from "@/lib/api/capabilities";
import { CapabilityBadge } from "@/components/shared/capability-badge";
import type { CapabilitiesResponse } from "@/lib/api/types";
import { PageHeader, RefreshButton } from "@/components/shared/page-header";
import { StatusItem } from "@/app/(dashboard)/overview/_components/status-item";
import { MachinesTable } from "@/app/(dashboard)/machines/_components/machines-table";

const MACHINES_POLL_MS = 30_000;

export default function MachinesPage() {
  const caps = useApiResource<CapabilitiesResponse>(() => apiClient.getCapabilities(), {});
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const interval = window.setInterval(refresh, MACHINES_POLL_MS);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const capsData = caps.status === "success" ? caps.data : null;
  const machinesCap = capabilityFor(capsData, "machines.list");
  const lapiCap = capabilityFor(capsData, "lapi.status");
  const capiCap = capabilityFor(capsData, "capi.status");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Machines / status"
        description="Registered machines and LAPI/CAPI status from live cscli responses (REQ-023)."
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

      <section aria-labelledby="machines-list">
        <h2
          id="machines-list"
          className="text-sm font-semibold uppercase tracking-wide text-slate-500"
        >
          Machines
        </h2>
        <div className="mt-3">
          <MachinesTable
            capability={machinesCap}
            fetcher={() => apiClient.listMachines()}
            refreshKey={tick}
          />
        </div>
      </section>

      <section aria-labelledby="machines-status">
        <h2
          id="machines-status"
          className="text-sm font-semibold uppercase tracking-wide text-slate-500"
        >
          Status
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <StatusItem
            label="LAPI status"
            operation="lapi.status"
            capability={lapiCap}
            fetcher={() => apiClient.getLapiStatus()}
            refreshKey={tick}
            pollIntervalMs={MACHINES_POLL_MS}
            render={(envelope) => (
              <p className="text-sm text-slate-700">
                {String(envelope.result.status ?? "unknown")}
              </p>
            )}
          />
          <CapiStatusCard
            capability={capiCap}
            refreshKey={tick}
            pollIntervalMs={MACHINES_POLL_MS}
          />
        </div>
      </section>
    </div>
  );
}

function CapiStatusCard({
  capability,
  refreshKey,
  pollIntervalMs,
}: {
  capability: CapabilityState;
  refreshKey: unknown;
  pollIntervalMs: number;
}) {
  if (capability === "unsupported") {
    return (
      <div className="rounded-md border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">CAPI status</h3>
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
      label="CAPI status"
      operation="capi.status"
      capability={capability}
      fetcher={() => apiClient.getCapiStatus()}
      refreshKey={refreshKey}
      pollIntervalMs={pollIntervalMs}
      render={(envelope) => (
        <p className="text-sm text-slate-700">
          {envelope.result.connected === true
            ? "Connected"
            : envelope.result.connected === false
              ? "Disconnected"
              : String(envelope.result.status ?? "unknown")}
        </p>
      )}
    />
  );
}
