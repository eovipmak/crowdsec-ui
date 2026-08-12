"use client";

/**
 * AlertDetail — single-alert detail from `alerts.inspect <id>` (matrix row,
 * page mode `none`). Renders known fields only; unknown fields are ignored
 * (architecture §7). Distinct loading / empty / error / unsupported states
 * are shown, and the caller owns capability gating.
 */
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { apiClient } from "@/lib/api/client";
import type { SuccessEnvelope } from "@/lib/api/types";
import type { CapabilityState } from "@/lib/api/capabilities";
import { CapabilityBadge } from "@/components/shared/capability-badge";
import { ErrorState, LoadingState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";

interface AlertDetailProps {
  id: number;
  capability: CapabilityState;
  onClose: () => void;
}

interface AlertDetailEnvelope extends SuccessEnvelope<Record<string, unknown>> {
  result: Record<string, unknown>;
}

export function AlertDetail({ id, capability, onClose }: AlertDetailProps) {
  const resource = useApiResource<AlertDetailEnvelope>(
    () => apiClient.inspectAlert({ id }) as Promise<AlertDetailEnvelope>,
    { key: id },
  );

  const data = resource.status === "success" ? resource.data.result : null;

  return (
    <section
      aria-labelledby="alert-detail-heading"
      className="rounded-md border border-slate-200 bg-white p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="alert-detail-heading" className="text-sm font-semibold text-slate-900">
          Alert detail
        </h2>
        <div className="flex items-center gap-2">
          <CapabilityBadge state={capability} />
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      <div className="mt-3">
        {capability === "unsupported" ? (
          <p className="text-sm text-slate-500">
            Alert inspection is not supported by this installation. No control is available.
          </p>
        ) : resource.status === "loading" ? (
          <LoadingState label="Loading alert…" />
        ) : resource.status === "error" ? (
          <ErrorState
            title="Could not load this alert"
            error={resource.error}
            onRetry={() => void resource.refresh()}
          />
        ) : (
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DetailItem label="ID" value={readString(data, "id")} />
            <DetailItem label="Started" value={formatDate(readString(data, "start_at"))} />
            <DetailItem label="Scenario" value={readString(data, "scenario")} />
            <DetailItem label="Scope" value={readString(data, "scope")} />
            <DetailItem label="Value" value={readString(data, "value")} />
            <DetailItem label="Decisions" value={formatDecisions(readArray(data, "decisions"))} />
          </dl>
        )}
      </div>
    </section>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm text-slate-800">{value || "—"}</dd>
    </div>
  );
}

function readString(obj: Record<string, unknown> | null, key: string): string {
  if (!obj) {
    return "";
  }
  const v = obj[key];
  return typeof v === "string" ? v : v === null || v === undefined ? "" : String(v);
}

function readArray(
  obj: Record<string, unknown> | null,
  key: string,
): Array<Record<string, unknown>> {
  if (!obj) {
    return [];
  }
  const v = obj[key];
  return Array.isArray(v) ? (v as Array<Record<string, unknown>>) : [];
}

function formatDate(value: string): string {
  if (!value) {
    return "";
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

function formatDecisions(decisions: Array<Record<string, unknown>>): string {
  if (decisions.length === 0) {
    return "";
  }
  return decisions
    .map((d) => {
      const type = typeof d.type === "string" ? d.type : "";
      const duration = typeof d.duration === "string" ? d.duration : "";
      return duration ? `${type} (${duration})` : type;
    })
    .join(", ");
}
