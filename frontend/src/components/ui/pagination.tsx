import { Button } from "@/components/ui/button";

export interface PaginationState {
  /** Matrix page mode: only `limit` supports page controls (architecture §4.8). */
  mode: "limit" | "offset" | "cursor" | "none";
  limit: number;
  offset: number;
  has_more: boolean;
}

interface PaginationProps {
  pagination: PaginationState;
  onRefresh: () => void;
}

/**
 * Pagination controls honoring the matrix page mode.
 *
 * offset is not part of the MVP request surface (architecture §4.8), so in
 * `limit` mode the only control is an explicit Refresh — has_more is
 * informational only and never drives unbounded fetching. `none`/`offset`/
 * `cursor` modes render no controls.
 */
export function Pagination({ pagination, onRefresh }: PaginationProps) {
  if (pagination.mode !== "limit") {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
      <p className="text-xs text-slate-500">
        Showing up to {pagination.limit} results
        {pagination.has_more
          ? " — more results exist; this installation does not support paging past this point."
          : "."}
      </p>
      <Button variant="secondary" size="sm" onClick={onRefresh}>
        Refresh
      </Button>
    </div>
  );
}
