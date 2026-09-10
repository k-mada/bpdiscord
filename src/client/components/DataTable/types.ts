export interface ColumnDef<T, HeaderCtx = unknown> {
  key: keyof T | string;
  label: string;
  sortKey?: string;
  sortDirection?: "none" | "asc" | "desc";
  customLabel?: (ctx: HeaderCtx | undefined) => React.ReactNode;
  renderColumn?: (data: T) => React.ReactNode;
  /** Ascending comparator; DataTable negates it for descending order. */
  customSort?: (a: T, b: T) => number;
}

export interface TableProps<T, HeaderCtx = unknown> {
  data: T[];
  columns: ColumnDef<T, HeaderCtx>[];
  enableSort?: boolean;
  /** Seeds the initial active sort (column key + direction) when enableSort. */
  initialSort?: { key: string; direction: "asc" | "desc" };
  headerContext?: HeaderCtx;
  renderRow?: (data: T, index: number) => React.ReactNode;
  /**
   * Pin the header to the top and offset focused body links to clear it. Only
   * meaningful inside a bounded scrolling ancestor, which the consumer owns —
   * defaults false so a table in normal flow renders a plain header.
   */
  stickyHeader?: boolean;
}
