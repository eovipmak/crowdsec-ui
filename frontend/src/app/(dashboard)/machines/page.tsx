import { PagePlaceholder } from "@/components/shared/page-placeholder";

export const metadata = {
  title: "Machines / Status · CrowdSec Dashboard",
};

/**
 * Machines and status (REQ-023): machines.list, lapi.status, optional
 * capi.status, and capability-gated machines.prune (never --force). Data
 * workflow owned by task 08.
 */
export default function MachinesPage() {
  return (
    <PagePlaceholder
      title="Machines / Status"
      description="Registered machines and LAPI/CAPI status via cscli (REQ-023)."
      workflowOwner="task 08 — overview, machines, status, and statistics views"
      operations={["machines.list", "machines.prune", "lapi.status", "capi.status"]}
    />
  );
}
