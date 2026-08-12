"use client";

/**
 * ProfilesView — read-only profile summaries from `profiles.inspect`
 * (matrix row, page mode `none`, architecture §6.1).
 *
 * `profiles.inspect` is NOT a `cscli` command — it is a read of the
 * server-side `/etc/crowdsec/profiles.yaml` through a separately approved
 * configuration-reader boundary (matrix §4). Profiles are READ-ONLY in the
 * MVP: there is no profile editing, expression input, or notification wiring
 * (matrix §4; architecture §5.3). Only known fields are rendered; unknown
 * fields are ignored (architecture §7). Distinct loading / empty / error /
 * unsupported states are shown, and the caller owns capability gating so an
 * unsupported row renders no control and no fetch.
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
import type { ProfileItem, SuccessEnvelope } from "@/lib/api/types";

interface ProfilesViewProps {
  capability: CapabilityState;
  refreshKey: unknown;
}

const COLUMNS: Column<ProfileItem>[] = [
  {
    key: "name",
    header: "Profile",
    render: (row) => row.name ?? "—",
  },
  {
    key: "filters",
    header: "Filters",
    render: (row) => (row.filters && row.filters.length > 0 ? row.filters.join(", ") : "—"),
  },
  {
    key: "decisions",
    header: "Decisions",
    hiddenOnMobile: true,
    render: (row) => (row.decisions && row.decisions.length > 0 ? row.decisions.join(", ") : "—"),
  },
];

/**
 * Profiles are READ-ONLY. Notification wiring and profile editing are
 * explicitly out of scope, so no notification hint column or edit control is
 * rendered — the profile list reflects the configured profiles.yaml only.
 */
export function ProfilesView({ capability, refreshKey }: ProfilesViewProps) {
  const resource = useApiResource<SuccessEnvelope<ProfileItem[]>>(
    () => apiClient.inspectProfiles(),
    { key: refreshKey },
  );
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  useEffect(() => {
    if (resource.status === "success") {
      setLoadedAt(new Date());
    }
  }, [resource.status, resource.data]);

  const items = resource.status === "success" ? resource.data.result : [];

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">Configured profiles</h3>
        <CapabilityBadge state={capability} />
      </div>

      <div className="mt-3">
        {capability === "unsupported" ? (
          <p className="text-sm text-slate-500">
            Profile inspection is not supported by this installation. No control is available.
          </p>
        ) : resource.status === "loading" ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : resource.status === "error" ? (
          <div role="alert" className="flex flex-col gap-2">
            <p className="text-sm text-red-700">
              {isApiError(resource.error)
                ? resource.error.message
                : "The profiles operation did not complete."}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => void resource.refresh()}>
                Retry
              </Button>
              <span className="font-mono text-xs text-red-600">profiles.inspect</span>
            </div>
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="No profiles configured"
            message="The current profiles file returned no profile summaries."
          />
        ) : (
          <div>
            <DataTable
              columns={COLUMNS}
              rows={items}
              rowKey={(row) => row.name ?? row.filters?.join("|") ?? "profile"}
              caption="Configured CrowdSec profiles (read-only)"
            />
            {loadedAt ? (
              <p className="mt-2 text-xs text-slate-400">
                Refreshed at {loadedAt.toLocaleString()} · profiles.inspect
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
