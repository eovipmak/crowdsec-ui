import type { ReactNode } from 'react';

type FiltersBarProps = {
  children?: ReactNode;
  /** Limit picker values (25/50/100). Skeleton for task-10 wiring. */
  limit?: number;
  onLimitChange?: (limit: number) => void;
};

/**
 * Section-specific filter inputs + limit picker (plan §7.1). Skeleton — the
 * page-level filter state and inputs land in task-10.
 */
export default function FiltersBar({ children, limit, onLimitChange }: FiltersBarProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {children}
      {limit !== undefined && onLimitChange ? (
        <select
          value={limit}
          onChange={(e) => onLimitChange(Number(e.target.value))}
          className="rounded-md border bg-background px-2 py-1 text-sm"
        >
          {[25, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n} rows
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}
