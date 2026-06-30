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
  headerContext?: HeaderCtx;
  renderRow?: (data: T, index: number) => React.ReactNode;
}
