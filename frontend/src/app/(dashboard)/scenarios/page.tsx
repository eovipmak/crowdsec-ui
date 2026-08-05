import { PagePlaceholder } from "@/components/shared/page-placeholder";

export const metadata = {
  title: "Scenarios / Profiles / Collections · CrowdSec Dashboard",
};

/**
 * Read-only configuration views for scenarios, profiles, and collections
 * (REQ-024). No functional install/remove or profile-edit controls exist in
 * the MVP (architecture §5.3). Data workflow owned by task 10.
 */
export default function ScenariosPage() {
  return (
    <PagePlaceholder
      title="Scenarios / Profiles / Collections"
      description="Current component configuration — read-only in the MVP (REQ-024)."
      workflowOwner="task 10 — component, allowlist, and bouncer administration views"
      operations={[
        "scenarios.list",
        "scenarios.inspect",
        "collections.list",
        "hub.list",
        "profiles.inspect",
        "simulation.status",
      ]}
    />
  );
}
