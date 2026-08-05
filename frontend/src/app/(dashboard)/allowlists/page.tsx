import { PagePlaceholder } from "@/components/shared/page-placeholder";

export const metadata = {
  title: "Allowlists · CrowdSec Dashboard",
};

/**
 * Allowlist display and typed local mutations (create/add/remove/delete) per
 * the command matrix (REQ-025). Console-managed entries remain read-only. Data
 * workflow owned by task 10.
 */
export default function AllowlistsPage() {
  return (
    <PagePlaceholder
      title="Allowlists"
      description="Local allowlists with typed create/add/remove/delete mutations (REQ-025)."
      workflowOwner="task 10 — component, allowlist, and bouncer administration views"
      operations={[
        "allowlists.list",
        "allowlists.check",
        "allowlists.create",
        "allowlists.add",
        "allowlists.remove",
        "allowlists.delete",
      ]}
    />
  );
}
