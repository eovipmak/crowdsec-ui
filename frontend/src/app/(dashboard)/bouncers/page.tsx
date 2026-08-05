import { PagePlaceholder } from "@/components/shared/page-placeholder";

export const metadata = {
  title: "Bouncers · CrowdSec Dashboard",
};

/**
 * Bouncer listing with conditional local deletion (bouncers.delete) only when
 * capability probing permits it (REQ-025). The bouncer token is never accepted
 * or displayed. Data workflow owned by task 10.
 */
export default function BouncersPage() {
  return (
    <PagePlaceholder
      title="Bouncers"
      description="Registered bouncers; local deletion only when capability probing permits (REQ-025)."
      workflowOwner="task 10 — component, allowlist, and bouncer administration views"
      operations={["bouncers.list", "bouncers.delete"]}
    />
  );
}
