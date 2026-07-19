"use client";

/**
 * Reusable data table component (Req 22.1-22.5).
 *
 * Collapses to cards on mobile. Includes loading, empty, and error states
 * with aria-live announcements.
 */
import { type ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
  /** If true, hide on mobile (shown only in expanded card view) */
  hideOnMobile?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  keyExtractor: (item: T) => string;
}

export function DataTable<T>({
  columns,
  data,
  loading = false,
  error = null,
  emptyMessage = "No data to display.",
  keyExtractor,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div aria-live="polite" aria-busy="true" className="py-12 text-center">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
        <p className="mt-2 text-sm text-neutral-500">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="rounded-md border border-red-200 bg-red-50 px-4 py-8 text-center"
      >
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div aria-live="polite" className="py-12 text-center">
        <p className="text-sm text-neutral-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm" role="grid">
          <thead>
            <tr className="border-b border-neutral-200">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className="px-4 py-3 text-left font-medium text-neutral-500"
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr
                key={keyExtractor(item)}
                className="border-b border-neutral-100 hover:bg-neutral-50"
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3">
                    {col.render(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card view */}
      <div className="sm:hidden space-y-3" role="list">
        {data.map((item) => (
          <div
            key={keyExtractor(item)}
            role="listitem"
            className="rounded-lg border border-neutral-200 p-4 space-y-2"
          >
            {columns.map((col) => (
              <div key={col.key} className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-neutral-500">{col.header}</span>
                <span className="text-sm text-right">{col.render(item)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
