import { useMemo, useState } from "react";
import type { TableProps } from "./types";

type SortKey = {
  key: string;
  sortDirection: "none" | "asc" | "desc";
};

export function DataTable<T, HeaderCtx = unknown>({
  data,
  columns,
  enableSort = false,
  initialSort,
  headerContext,
  renderRow,
}: TableProps<T, HeaderCtx>) {
  const [sortKey, setSortKey] = useState<SortKey>(
    initialSort
      ? { key: initialSort.key, sortDirection: initialSort.direction }
      : { key: "", sortDirection: "asc" },
  );

  const sortedTable = useMemo(() => {
    if (!sortKey.key) return data;

    const column = columns.find((c) => (c.key as string) === sortKey.key);
    const key = sortKey.key as keyof T;
    const direction = sortKey.sortDirection === "desc" ? -1 : 1;

    // customSort (and the default) define the ascending order; `direction`
    // flips the result for descending so a single comparator covers both.
    const ascending =
      column?.customSort ??
      ((a: T, b: T) => {
        if (a[key] === b[key]) return 0;
        return a[key] > b[key] ? 1 : -1;
      });

    return [...data].sort((a, b) => direction * ascending(a, b));
  }, [data, columns, sortKey]);

  const handleSort = (key: string) => {
    setSortKey((prev) => ({
      key,
      sortDirection:
        prev.key === key && prev.sortDirection === "asc" ? "desc" : "asc",
    }));
  };

  const sortGlyph = (active: boolean, direction: SortKey["sortDirection"]) => (
    <span
      aria-hidden="true"
      className={`text-xs ${active ? "" : "text-letterboxd-text-muted"}`}
    >
      {!active ? "⇅" : direction === "asc" ? "▲" : "▼"}
    </span>
  );

  return (
    <table className="data-table">
      <thead>
        <tr>
          {columns.map((column) => {
            const canSort = Boolean(column.sortKey && enableSort);
            const isActiveSort = sortKey.key === (column.key as string);
            const label = column.customLabel
              ? column.customLabel(headerContext)
              : column.label;

            return (
              <th
                key={column.key as string}
                aria-sort={
                  !canSort
                    ? undefined
                    : !isActiveSort
                      ? "none"
                      : sortKey.sortDirection === "asc"
                        ? "ascending"
                        : "descending"
                }
                className="sticky top-0 text-left py-3 px-4 text-letterboxd-text-secondary font-medium z-1 bg-letterboxd-bg-secondary"
              >
                {canSort ? (
                  <button
                    type="button"
                    onClick={() => handleSort(column.key as string)}
                    className="sort-control inline-flex items-center gap-1 border-0 bg-transparent p-0 font-medium text-letterboxd-text-secondary hover:text-letterboxd-text-primary cursor-pointer"
                  >
                    {label}
                    {sortGlyph(isActiveSort, sortKey.sortDirection)}
                  </button>
                ) : (
                  label
                )}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {sortedTable.map((item, index) => {
          if (renderRow) {
            return renderRow(item, index);
          }

          return (
            <tr key={`row-${index}`}>
              {columns.map((column) => {
                const value = item[column.key as keyof T];
                return (
                  <td key={column.key as string}>
                    {column.renderColumn
                      ? column.renderColumn(item)
                      : (value as string)}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
