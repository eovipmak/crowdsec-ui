"use client";

/**
 * Stable page placeholder for the dashboard shell (task 07).
 *
 * Renders the page header plus a read-only capability table for the matrix
 * operations the page will consume (GET /api/v1/capabilities). Page-specific
 * data workflows are owned by tasks 08–10; this placeholder only establishes
 * the shared states: loading, error (with retry), empty, and the
 * supported / environment-dependent / unsupported distinction.
 */
import { apiClient } from "@/lib/api/client";
import type { CapabilitiesResponse } from "@/lib/api/types";
import type { OperationId } from "@/lib/api/types";
import { capabilityFor } from "@/lib/api/capabilities";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { PageHeader, RefreshButton } from "@/components/shared/page-header";
import { ErrorState, LoadingState, EmptyState } from "@/components/shared/states";
import { CapabilityBadge } from "@/components/shared/capability-badge";

export interface PagePlaceholderProps {
  title: string;
  description: string;
  /** Matrix operations this page will consume (informational capability listing). */
  operations: OperationId[];
  /** Where the page-specific data workflow is implemented (task 08/09/10). */
  workflowOwner?: string;
}

export function PagePlaceholder({
  title,
  description,
  operations,
  workflowOwner,
}: PagePlaceholderProps) {
  const resource = useApiResource<CapabilitiesResponse>(apiClient.getCapabilities);

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        actions={
          resource.status === "success" ? (
            <RefreshButton
              onClick={() => void resource.refresh()}
              disabled={resource.isRefreshing}
            />
          ) : undefined
        }
      />

      {workflowOwner ? (
        <div className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          <span className="font-medium text-slate-700">Shell placeholder.</span> Page-specific data
          workflows for this view are implemented in{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">{workflowOwner}</code>. This
          page currently establishes the shared states only.
        </div>
      ) : null}

      {resource.status === "loading" ? (
        <LoadingState label="Loading operation capabilities…" />
      ) : resource.status === "error" ? (
        <ErrorState
          title="Could not load operation capabilities"
          error={resource.error}
          onRetry={() => void resource.refresh()}
        />
      ) : (
        <section
          aria-label="Operation support"
          className="rounded-md border border-slate-200 bg-white"
        >
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">
              Matrix operations for this page
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Support comes from the server&apos;s startup capability probe; rows marked unsupported
              will never offer a control.
            </p>
          </div>
          {operations.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No operations"
                message="This page does not consume any matrix operations."
              />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {operations.map((op) => (
                <li key={op} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <code className="text-xs text-slate-700">{op}</code>
                  <CapabilityBadge state={capabilityFor(resource.data, op)} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
