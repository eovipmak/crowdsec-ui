"use client";

/**
 * Scenarios / Profiles / Collections — read-only configuration views
 * (REQ-024).
 *
 * Every operation here is READ-ONLY in the MVP: `scenarios.list` /
 * `scenarios.inspect`, `collections.list`, `hub.list`, `profiles.inspect`
 * (read-only profiles file boundary), and `simulation.status`. There are no
 * functional install/remove or enable/disable controls — the matrix marks
 * `scenarios.install`, `collections.install`, `collections.remove`,
 * `simulation.enable`, `simulation.disable`, and `hub.update` as explicitly
 * unsupported (architecture §5.3). Capability badges mark environment-
 * dependent rows; unsupported rows render no control at all.
 *
 * Refresh is explicit plus a single bounded poll (30s); there is no
 * unbounded fetching and no local store. Each section fetches independently
 * so one failure does not hide the rest.
 */
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { apiClient } from "@/lib/api/client";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { capabilityFor } from "@/lib/api/capabilities";
import type { CapabilitiesResponse } from "@/lib/api/types";
import { PageHeader, RefreshButton } from "@/components/shared/page-header";
import { ScenariosTable } from "@/app/(dashboard)/scenarios/_components/scenarios-table";
import { CollectionsTable } from "@/app/(dashboard)/scenarios/_components/collections-table";
import { HubInventory } from "@/app/(dashboard)/scenarios/_components/hub-inventory";
import { ProfilesView } from "@/app/(dashboard)/scenarios/_components/profiles-view";
import { SimulationStatusCard } from "@/app/(dashboard)/scenarios/_components/simulation-status-card";

const COMPONENTS_POLL_MS = 30_000;

export default function ScenariosPage() {
  const caps = useApiResource<CapabilitiesResponse>(() => apiClient.getCapabilities(), {});
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const interval = window.setInterval(refresh, COMPONENTS_POLL_MS);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const capsData = caps.status === "success" ? caps.data : null;
  const scenariosCap = capabilityFor(capsData, "scenarios.list");
  const collectionsCap = capabilityFor(capsData, "collections.list");
  const hubCap = capabilityFor(capsData, "hub.list");
  const profilesCap = capabilityFor(capsData, "profiles.inspect");
  const simulationCap = capabilityFor(capsData, "simulation.status");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scenarios / Profiles / Collections"
        description="Current component configuration from live cscli responses — read-only in the MVP (REQ-024)."
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

      <Section title="Scenarios">
        <ScenariosTable
          capability={scenariosCap}
          fetcher={() => apiClient.listScenarios()}
          refreshKey={tick}
        />
      </Section>

      <Section title="Collections">
        <CollectionsTable
          capability={collectionsCap}
          fetcher={() => apiClient.listCollections()}
          refreshKey={tick}
        />
      </Section>

      <Section title="Hub inventory">
        <HubInventory capability={hubCap} refreshKey={tick} />
      </Section>

      <Section title="Profiles">
        <ProfilesView capability={profilesCap} refreshKey={tick} />
      </Section>

      <Section title="Simulation">
        <SimulationStatusCard capability={simulationCap} refreshKey={tick} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`section-${title.toLowerCase().replace(/\W+/g, "-")}`}>
      <h2
        id={`section-${title.toLowerCase().replace(/\W+/g, "-")}`}
        className="text-sm font-semibold uppercase tracking-wide text-slate-500"
      >
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
