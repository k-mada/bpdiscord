import { createRoot } from "react-dom/client";
import { DataTable } from "../../../components/DataTable/DataTable";
import type { ColumnDef } from "../../../components/DataTable/types";
import "../../../index.css";

interface FilmRow {
  title: string;
  slug: string;
}

const ROWS: FilmRow[] = Array.from({ length: 30 }, (_, i) => ({
  title: `Film number ${i + 1}`,
  slug: `film-number-${i + 1}`,
}));

// A label long enough to wrap to two lines inside max-w-40, so the sticky
// header reaches its worst-case height and the offset must clear all of it.
const columns: ColumnDef<FilmRow>[] = [
  {
    key: "title",
    label: "The full film title column header that wraps",
    renderColumn: (row) => (
      <a
        href={`https://letterboxd.com/film/${row.slug}`}
        target="_blank"
        rel="noreferrer"
        data-testid={`link-${row.slug}`}
      >
        {row.title}
      </a>
    ),
  },
];

const Harness = () => (
  <main style={{ padding: 24 }}>
    <button type="button" data-testid="before">
      before
    </button>

    <div className="overflow-x-auto max-h-[50vh]" data-testid="scroller">
      <DataTable data={ROWS} columns={columns} stickyHeader />
    </div>
  </main>
);

createRoot(document.getElementById("root")!).render(<Harness />);
