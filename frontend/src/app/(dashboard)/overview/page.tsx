import { PagePlaceholder } from "@/components/shared/page-placeholder";

export const metadata = {
  title: "Overview · CrowdSec Dashboard",
};

/**
 * System overview (REQ-021). Data workflow owned by task 08; this shell page
 * establishes the placeholder and capability states.
 */
export default function OverviewPage() {
  return (
    <PagePlaceholder
      title="Overview"
      description="CrowdSec status, machines, and current alert/decision counts (REQ-021)."
      workflowOwner="task 08 — overview, machines, status, and statistics views"
      operations={[
        "alerts.list",
        "decisions.list",
        "machines.list",
        "lapi.status",
        "capi.status",
        "metrics.show",
      ]}
    />
  );
}
