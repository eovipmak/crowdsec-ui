import { PagePlaceholder } from "@/components/shared/page-placeholder";

export const metadata = {
  title: "Decisions · CrowdSec Dashboard",
};

/**
 * Decisions list (REQ-022) and matrix-approved mutations (decisions.add /
 * decisions.delete, architecture §6.2). Data workflow owned by task 09;
 * `decisions.inspect` does not exist in the matrix — detail stays list-based.
 */
export default function DecisionsPage() {
  return (
    <PagePlaceholder
      title="Decisions"
      description="Active decisions with list-based detail and confirmed add/delete mutations (REQ-022)."
      workflowOwner="task 09 — alerts and decisions workflows"
      operations={["decisions.list", "decisions.add", "decisions.delete"]}
    />
  );
}
