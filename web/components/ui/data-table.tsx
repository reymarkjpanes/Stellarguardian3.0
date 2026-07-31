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
  selectedKeys?: Set<string>;
  onSelectionChange?: (keys: Set<string>) => void;
}

export function DataTable<T>({
  columns,
  data,
  loading = false,
  error = null,
  emptyMessage = "No data to display.",
  keyExtractor,
  selectedKeys = new Set(),
  onSelectionChange,
}: DataTableProps<T>) {
  const isSelectable = !!onSelectionChange;

  function handleSelectAll(e: React.ChangeEvent<HTMLInputElement>) {
    if (!onSelectionChange) return;
    if (e.target.checked) {
      onSelectionChange(new Set(data.map(keyExtractor)));
    } else {
      onSelectionChange(new Set());
    }
  }

  function handleSelectRow(key: string, checked: boolean) {
    if (!onSelectionChange) return;
    const next = new Set(selectedKeys);
    if (checked) next.add(key);
    else next.delete(key);
    onSelectionChange(next);
  }

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
              {isSelectable && (
                <th scope="col" className="px-4 py-3 text-left w-12">
                  <input
                    type="checkbox"
                    className="rounded border-neutral-300 text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer"
                    checked={data.length > 0 && selectedKeys.size === data.length}
                    onChange={handleSelectAll}
                    aria-label="Select all rows"
                  />
                </th>
              )}
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
            {data.map((item) => {
              const key = keyExtractor(item);
              const isSelected = selectedKeys.has(key);
              return (
                <tr
                  key={key}
                  className={`border-b border-neutral-100 hover:bg-neutral-50 ${isSelected ? "bg-neutral-50" : ""}`}
                >
                  {isSelectable && (
                    <td className="px-4 py-3 w-12">
                      <input
                        type="checkbox"
                        className="rounded border-neutral-300 text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer"
                        checked={isSelected}
                        onChange={(e) => handleSelectRow(key, e.target.checked)}
                        aria-label={`Select row`}
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      {col.render(item)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile card view */}
      <div className="sm:hidden space-y-3" role="list">
        {data.map((item) => {
          const key = keyExtractor(item);
          const isSelected = selectedKeys.has(key);
          return (
            <div
              key={key}
              className={`card p-4 space-y-3 ${isSelected ? "ring-2 ring-[var(--accent)]" : ""}`}
            >
              {isSelectable && (
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[var(--border)]">
                  <input
                    type="checkbox"
                    className="rounded border-neutral-300 text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer"
                    checked={isSelected}
                    onChange={(e) => handleSelectRow(key, e.target.checked)}
                    id={`select-${key}`}
                  />
                  <label htmlFor={`select-${key}`} className="text-sm font-medium cursor-pointer">
                    Select Item
                  </label>
                </div>
              )}
              {columns
                .filter((col) => !col.hideOnMobile)
                .map((col) => (
                  <div key={col.key} className="flex flex-col">
                    <span className="text-xs font-medium text-neutral-500 mb-1">{col.header}</span>
                    <div className="text-sm text-neutral-900">{col.render(item)}</div>
                  </div>
                ))}
            </div>
          );
        })}
      </div>
    </>
  );
}
