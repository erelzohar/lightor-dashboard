import React, { useEffect, useRef, useState } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Search, Inbox } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';

/**
 * Server-driven data table (LT-058) — the first real table in the app (owner
 * pages are card stacks). Pagination, sorting and search all happen on the
 * SERVER: this component only reports intent through callbacks and renders
 * the page it was given. Never feed it a full collection.
 *
 * RTL-first: logical utilities only, `text-start` cells; wrap identifiers,
 * emails and phone numbers in the render fn with `dir="ltr"` spans.
 */

export interface DataTableColumn<T> {
  key: string;
  label: string;
  sortable?: boolean;
  /** Custom cell renderer; defaults to the row's `key` property as text. */
  render?: (row: T) => React.ReactNode;
  /** Extra classes for header + cells, e.g. 'hidden md:table-cell'. */
  className?: string;
}

export interface DataTablePagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  pagination?: DataTablePagination;
  onPageChange?: (page: number) => void;
  sort?: string;
  order?: 'asc' | 'desc';
  onSortChange?: (sort: string, order: 'asc' | 'desc') => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  /** Rendered inline next to the search box — filter selects live here. */
  toolbar?: React.ReactNode;
}

const SEARCH_DEBOUNCE_MS = 300;

function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  pagination,
  onPageChange,
  sort,
  order,
  onSortChange,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  onRowClick,
  emptyMessage,
  toolbar,
}: DataTableProps<T>) {
  const { t } = useTranslation();
  const { direction } = useTheme();

  // Local echo of the search box so typing stays instant while the server
  // query trails behind by the debounce.
  const [searchDraft, setSearchDraft] = useState(searchValue ?? '');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setSearchDraft(searchValue ?? '');
  }, [searchValue]);

  const handleSearchInput = (value: string) => {
    setSearchDraft(value);
    if (!onSearchChange) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onSearchChange(value), SEARCH_DEBOUNCE_MS);
  };

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const handleSort = (column: DataTableColumn<T>) => {
    if (!column.sortable || !onSortChange) return;
    const nextOrder = sort === column.key && order === 'desc' ? 'asc' : 'desc';
    onSortChange(column.key, nextOrder);
  };

  const PrevIcon = direction === 'rtl' ? ChevronRight : ChevronLeft;
  const NextIcon = direction === 'rtl' ? ChevronLeft : ChevronRight;

  return (
    <div>
      {(onSearchChange || toolbar) && (
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          {onSearchChange && (
            <div className="relative flex-1 min-w-0">
              <Search
                size={16}
                className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
              <input
                type="text"
                value={searchDraft}
                onChange={(e) => handleSearchInput(e.target.value)}
                placeholder={searchPlaceholder ?? t('admin.table.search')}
                className="w-full ps-9 pe-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700/80 bg-white dark:bg-dark-surface text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
          )}
          {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl glass-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800/60 bg-gray-50/70 dark:bg-gray-800/30">
              {columns.map((column) => (
                <th
                  key={column.key}
                  onClick={() => handleSort(column)}
                  className={[
                    'px-4 py-3 text-start font-semibold text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 whitespace-nowrap select-none',
                    column.sortable && onSortChange ? 'cursor-pointer hover:text-gray-800 dark:hover:text-gray-200' : '',
                    column.className ?? '',
                  ].join(' ')}
                >
                  <span className="inline-flex items-center gap-1">
                    {column.label}
                    {column.sortable && sort === column.key && (
                      order === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skeleton-${i}`} className="border-b border-gray-50 dark:border-gray-800/40">
                  {columns.map((column) => (
                    <td key={column.key} className={`px-4 py-3.5 ${column.className ?? ''}`}>
                      <div className="h-4 rounded bg-gray-100 dark:bg-gray-800 animate-pulse w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12">
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <Inbox size={28} />
                    <span className="text-sm">{emptyMessage ?? t('admin.table.empty')}</span>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={() => onRowClick?.(row)}
                  className={[
                    'border-b border-gray-50 dark:border-gray-800/40 last:border-0 transition-colors',
                    onRowClick ? 'cursor-pointer hover:bg-primary/[0.03] dark:hover:bg-primary/10' : '',
                  ].join(' ')}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-4 py-3.5 text-gray-700 dark:text-gray-200 whitespace-nowrap ${column.className ?? ''}`}
                    >
                      {column.render
                        ? column.render(row)
                        : String((row as Record<string, unknown>)[column.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && pagination.pages > 1 && onPageChange && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {t('admin.table.showing', {
              count: rows.length,
              total: pagination.total,
            })}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
              aria-label={t('admin.table.previousPage')}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <PrevIcon size={16} />
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-300 px-2 tabular-nums" dir="ltr">
              {pagination.page} / {pagination.pages}
            </span>
            <button
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.pages || loading}
              aria-label={t('admin.table.nextPage')}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <NextIcon size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTable;
