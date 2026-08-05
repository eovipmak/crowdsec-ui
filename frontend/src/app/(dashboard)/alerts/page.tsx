import { PagePlaceholder } from "@/components/shared/page-placeholder";

export const metadata = {
  title: "Alerts · CrowdSec Dashboard",
};

/**
 * Searchable, filterable, paginated alerts table (REQ-022). Data workflow
 * owned by task 09; page mode is limit-only when capability probing confirms
 * the -l flag, otherwise none (architecture §4.8).
 */
export default function AlertsPage() {
  return (
    <PagePlaceholder
      title="Alerts"
      description="Searchable, filterable, paginated alert table with detail views (REQ-022)."
      workflowOwner="task 09 — alerts and decisions workflows"
      operations={["alerts.list", "alerts.inspect"]}
    />
  );
}
