import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  className?: string;
  /** Hide on small screens. */
  hiddenOnMobile?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  emptyMessage?: string;
  caption?: string;
  /** Optional actions column rendered at the end. */
  actions?: (row: T) => ReactNode;
}

/**
 * Accessible data table: native <table> with a caption, header scope, and
 * row-level keyboard focus (tabIndex=0) so operators can navigate rows.
 * Emptiness is delegated to the EmptyState component by the caller — this
 * table simply renders the rows it receives.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyMessage,
  caption,
  actions,
}: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead className="bg-slate-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 ${
                  col.hiddenOnMobile ? "hidden md:table-cell" : ""
                } ${col.className ?? ""}`}
              >
                {col.header}
              </th>
            ))}
            {actions ? (
              <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                Actions
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (actions ? 1 : 0)} className="px-4 py-8 text-center text-sm text-slate-500">
                {emptyMessage ?? "No items to display."}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                tabIndex={0}
                className="focus:bg-slate-50 focus:outline-2 focus:outline-slate-500"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 align-top text-slate-700 ${
                      col.hiddenOnMobile ? "hidden md:table-cell" : ""
                    } ${col.className ?? ""}`}
                  >
                    {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? "")}
                  </td>
                ))}
                {actions ? <td className="px-4 py-3 text-right">{actions(row)}</td> : null}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
