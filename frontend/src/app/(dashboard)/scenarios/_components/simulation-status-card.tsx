"use client";

/**
 * SimulationStatusCard — read-only simulation status from `simulation.status`
 * (matrix row, page mode `none`, architecture §6.1).
 *
 * READ-ONLY in the MVP: `simulation.enable` / `simulation.disable` are
 * explicitly unsupported rows (matrix §4; architecture §5.3), so no
 * enable/disable control is rendered. The card shows whether simulation is
 * on and any scenario list the API returns. Only known fields are rendered;
 * unknown fields are ignored (architecture §7). The caller owns capability
 * gating so an unsupported row renders no control and no fetch.
 */
import { useEffect, useState } from "react";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { apiClient } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { CapabilityBadge } from "@/components/shared/capability-badge";
import { Button } from "@/components/ui/button";
import type { CapabilityState } from "@/lib/api/capabilities";
import type { SuccessEnvelope } from "@/lib/api/types";

interface SimulationStatusCardProps {
  capability: CapabilityState;
  refreshKey: unknown;
}

/**
 * The backend adapter reports simulations as `{ enabled: boolean }`
 * (SimulationStatusItem). The shared `SimulationStatus` type only declares
 * `simulation_enabled?`, so we read the enabled flag defensively from the
 * known index-signature fields.
 */
function isEnabled(envelope: SuccessEnvelope<{ [key: string]: unknown }>): boolean {
  const r = envelope.result;
  if (typeof r.enabled === "boolean") {
    return r.enabled;
  }
  return r.simulation_enabled === true;
}

export function SimulationStatusCard({ capability, refreshKey }: SimulationStatusCardProps) {
  const resource = useApiResource<SuccessEnvelope<{ [key: string]: unknown }>>(
    () => apiClient.getSimulationStatus(),
    { key: refreshKey },
  );
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  useEffect(() => {
    if (resource.status === "success") {
      setLoadedAt(new Date());
    }
  }, [resource.status, resource.data]);

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">Simulation status</h3>
        <CapabilityBadge state={capability} />
      </div>

      <div className="mt-3">
        {capability === "unsupported" ? (
          <p className="text-sm text-slate-500">
            Simulation status is not supported by this installation. No control is available.
          </p>
        ) : resource.status === "loading" ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : resource.status === "error" ? (
          <div role="alert" className="flex flex-col gap-2">
            <p className="text-sm text-red-700">
              {isApiError(resource.error)
                ? resource.error.message
                : "The simulation status operation did not complete."}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => void resource.refresh()}>
                Retry
              </Button>
              <span className="font-mono text-xs text-red-600">simulation.status</span>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex h-2.5 w-2.5 rounded-full ${
                  isEnabled(resource.data) ? "bg-emerald-500" : "bg-slate-300"
                }`}
              />
              <p className="text-sm text-slate-700">
                {isEnabled(resource.data) ? "Simulation is on" : "Simulation is off"}
              </p>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Simulation is read-only in this dashboard. There is no enable/disable control.
            </p>
            {loadedAt ? (
              <p className="mt-2 text-xs text-slate-400">
                Refreshed at {loadedAt.toLocaleString()} · simulation.status
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
