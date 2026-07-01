import { render, screen, fireEvent } from "@testing-library/react";
import { DataTable } from "../components/DataTable/DataTable";
import type { ColumnDef } from "../components/DataTable/types";

interface Row {
  name: string;
  score: number;
}

const rows: Row[] = [
  { name: "Bravo", score: 2 },
  { name: "Alpha", score: 3 },
  { name: "Charlie", score: 1 },
];

const basicColumns: ColumnDef<Row>[] = [
  { key: "name", label: "Name", sortKey: "name" },
  { key: "score", label: "Score", sortKey: "score" },
];

const bodyColumn = (container: HTMLElement, cell = 0): string[] =>
  Array.from(container.querySelectorAll("tbody tr")).map(
    (tr) => tr.querySelectorAll("td")[cell]?.textContent ?? "",
  );

describe("DataTable", () => {
  describe("headers", () => {
    it("renders the static column label by default", () => {
      render(<DataTable data={rows} columns={basicColumns} />);

      expect(
        screen.getByRole("columnheader", { name: "Name" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("columnheader", { name: "Score" }),
      ).toBeInTheDocument();
    });

    it("renders customLabel from headerContext when provided", () => {
      interface Ctx {
        user1: string;
        user2: string;
      }
      const columns: ColumnDef<Row, Ctx>[] = [
        {
          key: "name",
          label: "Name",
          customLabel: (ctx) => ctx?.user1 ?? "Name",
        },
        {
          key: "score",
          label: "Score",
          customLabel: (ctx) => ctx?.user2 ?? "Score",
        },
      ];

      render(
        <DataTable
          data={rows}
          columns={columns}
          headerContext={{ user1: "Alice", user2: "Bob" }}
        />,
      );

      expect(
        screen.getByRole("columnheader", { name: "Alice" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("columnheader", { name: "Bob" }),
      ).toBeInTheDocument();
    });

    it("falls back to the static label when headerContext is omitted", () => {
      const columns: ColumnDef<Row, { user1: string }>[] = [
        {
          key: "name",
          label: "Name",
          customLabel: (ctx) => ctx?.user1 ?? "Name",
        },
      ];

      render(<DataTable data={rows} columns={columns} />);

      expect(
        screen.getByRole("columnheader", { name: "Name" }),
      ).toBeInTheDocument();
    });
  });

  describe("rows", () => {
    it("renders cell values by column key", () => {
      const { container } = render(
        <DataTable data={rows} columns={basicColumns} />,
      );

      expect(bodyColumn(container)).toEqual(["Bravo", "Alpha", "Charlie"]);
      expect(bodyColumn(container, 1)).toEqual(["2", "3", "1"]);
    });

    it("uses renderColumn for cell content when provided", () => {
      const columns: ColumnDef<Row>[] = [
        { key: "name", label: "Name" },
        {
          key: "score",
          label: "Score",
          renderColumn: (row) => <span>{`★${row.score}`}</span>,
        },
      ];

      const { container } = render(
        <DataTable data={[{ name: "Bravo", score: 2 }]} columns={columns} />,
      );

      expect(bodyColumn(container, 1)).toEqual(["★2"]);
    });

    it("uses renderRow override instead of the default row markup", () => {
      render(
        <DataTable
          data={rows}
          columns={basicColumns}
          renderRow={(row, index) => (
            <tr key={index}>
              <td>{`custom-${row.name}`}</td>
            </tr>
          )}
        />,
      );

      expect(screen.getByText("custom-Bravo")).toBeInTheDocument();
    });

    it("reflects data prop changes after the initial render", () => {
      const { container, rerender } = render(
        <DataTable data={rows} columns={basicColumns} />,
      );
      expect(bodyColumn(container)).toEqual(["Bravo", "Alpha", "Charlie"]);

      rerender(
        <DataTable
          data={[{ name: "Delta", score: 9 }]}
          columns={basicColumns}
        />,
      );
      expect(bodyColumn(container)).toEqual(["Delta"]);
    });
  });

  describe("sorting", () => {
    it("does not render sort controls when enableSort is false", () => {
      const { container } = render(
        <DataTable data={rows} columns={basicColumns} />,
      );

      expect(container.querySelector(".sort-control")).toBeNull();
    });

    it("sorts ascending then descending on header click", () => {
      const { container } = render(
        <DataTable data={rows} columns={basicColumns} enableSort />,
      );

      const scoreControl = () =>
        container.querySelectorAll(".sort-control")[1] as Element;

      fireEvent.click(scoreControl());
      expect(bodyColumn(container)).toEqual(["Charlie", "Bravo", "Alpha"]);

      fireEvent.click(scoreControl());
      expect(bodyColumn(container)).toEqual(["Alpha", "Bravo", "Charlie"]);
    });

    it("applies sortDirection to a customSort comparator", () => {
      const columns: ColumnDef<Row>[] = [
        { key: "name", label: "Name" },
        {
          key: "score",
          label: "Score",
          sortKey: "score",
          customSort: (a, b) => a.score - b.score,
        },
      ];

      const { container } = render(
        <DataTable data={rows} columns={columns} enableSort />,
      );
      const control = () => container.querySelector(".sort-control") as Element;

      fireEvent.click(control());
      expect(bodyColumn(container)).toEqual(["Charlie", "Bravo", "Alpha"]);

      fireEvent.click(control());
      expect(bodyColumn(container)).toEqual(["Alpha", "Bravo", "Charlie"]);
    });

    it("shows the direction indicator only on the active column", () => {
      const { container } = render(
        <DataTable data={rows} columns={basicColumns} enableSort />,
      );
      const header = (i: number) =>
        container.querySelectorAll("th")[i] as Element;
      const scoreControl = () =>
        container.querySelectorAll(".sort-control")[1] as Element;

      fireEvent.click(scoreControl());
      expect(header(1).textContent).toContain("▲");
      expect(header(0).textContent).not.toContain("▲");
      expect(header(0).textContent).not.toContain("▼");

      fireEvent.click(scoreControl());
      expect(header(1).textContent).toContain("▼");
    });

    it("seeds the active sort from initialSort", () => {
      const { container } = render(
        <DataTable
          data={rows}
          columns={basicColumns}
          enableSort
          initialSort={{ key: "score", direction: "desc" }}
        />,
      );

      // score desc → 3, 2, 1
      expect(bodyColumn(container, 1)).toEqual(["3", "2", "1"]);
      const scoreTh = container.querySelectorAll("th")[1] as Element;
      expect(scoreTh.getAttribute("aria-sort")).toBe("descending");
      expect(scoreTh.textContent).toContain("▼");
    });

    it("renders sortable headers as keyboard-accessible buttons", () => {
      render(<DataTable data={rows} columns={basicColumns} enableSort />);

      expect(
        screen.getByRole("button", { name: "Score" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Name" })).toBeInTheDocument();
    });

    it("shows a neutral affordance on inactive sortable columns", () => {
      const { container } = render(
        <DataTable
          data={rows}
          columns={basicColumns}
          enableSort
          initialSort={{ key: "score", direction: "desc" }}
        />,
      );
      const nameTh = container.querySelectorAll("th")[0] as Element;

      expect(nameTh.getAttribute("aria-sort")).toBe("none");
      expect(nameTh.textContent).toContain("⇅");
      expect(nameTh.textContent).not.toContain("▲");
      expect(nameTh.textContent).not.toContain("▼");
    });
  });
});
