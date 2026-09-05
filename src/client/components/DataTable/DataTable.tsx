import { useMemo, useState } from "react";
import type { TableProps } from "./types";

type SortKey = {
  key: string;
  sortDirection: "none" | "asc" | "desc";
};

function ariaSort(
  canSort: boolean,
  isActive: boolean,
  direction: SortKey["sortDirection"],
): "ascending" | "descending" | "none" | undefined {
  if (!canSort) return undefined;
  if (!isActive) return "none";
  return direction === "asc" ? "ascending" : "descending";
}

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
            // Clamping hides the overflow, so the full text has to stay
            // reachable on hover. customLabel may return an element.
            const labelText =
              typeof label === "string" ? label : column.label;

            return (
              <th
                key={column.key as string}
                scope="col"
                aria-sort={ariaSort(
                  canSort,
                  isActiveSort,
                  sortKey.sortDirection,
                )}
                // align-bottom keeps one- and two-line headers sitting on the
                // same baseline as the row beneath them.
                className="sticky top-0 align-bottom text-left py-3 px-4 text-letterboxd-text-secondary font-medium z-1 bg-letterboxd-bg-secondary"
              >
                {canSort ? (
                  <button
                    type="button"
                    onClick={() => handleSort(column.key as string)}
                    title={labelText}
                    className="sort-control inline-flex max-w-40 items-end gap-1 border-0 bg-transparent p-0 text-left font-medium text-letterboxd-text-secondary hover:text-letterboxd-text-primary cursor-pointer"
                  >
                    <span className="line-clamp-2">{label}</span>
                    {sortGlyph(isActiveSort, sortKey.sortDirection)}
                  </button>
                ) : (
                  <span className="line-clamp-2 max-w-40" title={labelText}>
                    {label}
                  </span>
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
