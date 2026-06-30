import { useMemo, useState } from "react";
import type { TableProps } from "./types";

// import "./DataTable.css";

type SortKey = {
  key: string;
  sortDirection: "none" | "asc" | "desc";
};

export function DataTable<T, HeaderCtx = unknown>({
  data,
  columns,
  enableSort = false,
  headerContext,
  renderRow,
}: TableProps<T, HeaderCtx>) {
  const [sortKey, setSortKey] = useState<SortKey>({
    key: "",
    sortDirection: "asc",
  });

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

  const renderSortDirection = (direction: SortKey["sortDirection"]) => {
    if (direction === "none") {
      return null;
    }
    return direction === "asc" ? <span>▲</span> : <span>▼</span>;
  };

  return (
    <table className="data-table">
      <thead>
        <tr>
          {columns.map((column) => {
            const canSort = column.sortKey && enableSort;
            const isActiveSort = sortKey.key === (column.key as string);
            const sortControl = (
              <div
                className="sort-control"
                onClick={() => {
                  handleSort(column.key as string);
                }}
              >
                {renderSortDirection(
                  isActiveSort ? sortKey.sortDirection : "none",
                )}
              </div>
            );

            return (
              <th
                key={column.key as string}
                className="sticky top-0 text-left py-3 px-4 text-letterboxd-text-secondary font-medium z-1 bg-letterboxd-bg-secondary"
              >
                {canSort && sortControl}
                {column.customLabel
                  ? column.customLabel(headerContext)
                  : column.label}
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
