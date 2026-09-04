import { render, screen, within, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DataTable } from "../components/DataTable/DataTable";
import { mflFilmColumns } from "../components/DataTable/columns";
import MovieFantasyLeague from "../components/MovieFantasyLeague/Dashboard";
import { useMflData } from "../hooks/useMflData";
import type { MFLCatalogueFilm, MFLScoringMetric } from "../types";

vi.mock("../hooks/useMflData");

function film(over: Partial<MFLCatalogueFilm> = {}): MFLCatalogueFilm {
  return {
    title: "Anora",
    filmSlug: "anora",
    releaseDate: "2026-10-18",
    price: 40,
    totalPoints: 0,
    pointsByCategory: {},
    ...over,
  };
}

function metric(category: string): MFLScoringMetric {
  return {
    metricId: 1,
    metric: "m",
    metricName: "m",
    category,
    scoringCondition: "win",
    pointValue: 5,
  };
}

function renderTable(films: MFLCatalogueFilm[], categories: string[]) {
  return render(
    <MemoryRouter>
      <DataTable
        data={films}
        columns={mflFilmColumns(categories)}
        enableSort
        initialSort={{ key: "totalPoints", direction: "desc" }}
      />
    </MemoryRouter>,
  );
}

/** Row order by film title, skipping the header row. */
function titleOrder() {
  return screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[0]!.textContent);
}

function renderPage(
  movies: MFLCatalogueFilm[],
  scoringMetrics: MFLScoringMetric[],
  over: { loading?: boolean; error?: string | null } = {},
) {
  vi.mocked(useMflData).mockReturnValue({
    movies,
    scoringMetrics,
    loading: false,
    error: null,
    ...over,
  } as unknown as ReturnType<typeof useMflData>);

  return render(
    <MemoryRouter>
      <MovieFantasyLeague />
    </MemoryRouter>,
  );
}

describe("MFL films table columns", () => {
  it("keeps a category named like a static column from colliding with it", () => {
    // category is free text out of the DB, and ColumnDef.key doubles as the
    // React key and the value lookup.
    renderTable(
      [film({ price: 40, pointsByCategory: { price: 7 } })],
      ["price"],
    );

    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers.filter((h) => h?.includes("Price"))).toHaveLength(1);

    const cells = screen.getAllByRole("cell").map((c) => c.textContent);
    expect(cells).toContain("$40");
    expect(cells).toContain("7");
  });

  it("separates a category never awarded from one awarded zero", () => {
    renderTable(
      [film({ pointsByCategory: { awards: 0 } })],
      ["awards", "box_office"],
    );

    const cells = screen.getAllByRole("cell").map((c) => c.textContent);
    expect(cells).toContain("0");
    expect(cells.filter((c) => c === "—")).toHaveLength(1);
  });

  it("shows a column for a category nothing has scored in", () => {
    renderTable([film()], ["awards", "box_office"]);

    expect(
      screen.getByRole("columnheader", { name: /box_office/ }),
    ).toBeInTheDocument();
  });

  it("renders a null price and release date as an em dash", () => {
    renderTable([film({ price: null, releaseDate: null })], []);

    const cells = screen.getAllByRole("cell").map((c) => c.textContent);
    expect(cells.filter((c) => c === "—")).toHaveLength(2);
  });

  it("formats a release date without letting a timezone shift the day", () => {
    renderTable([film({ releaseDate: "2026-01-01" })], []);

    expect(screen.getByText("Jan 1, 2026")).toBeInTheDocument();
  });

  it("links the film cell to its breakdown", () => {
    renderTable([film()], []);

    expect(screen.getByRole("link", { name: "Anora" })).toHaveAttribute(
      "href",
      "/mfl/film/anora",
    );
  });

  it("opens sorted by total points, descending", () => {
    renderTable(
      [
        film({ title: "Low", filmSlug: "low", totalPoints: 9 }),
        film({ title: "High", filmSlug: "high", totalPoints: 35 }),
      ],
      [],
    );

    expect(titleOrder()).toEqual(["High", "Low"]);
  });

  it("sorts a category column by that category rather than the total", () => {
    renderTable(
      [
        film({
          title: "BigTotal",
          filmSlug: "big",
          totalPoints: 100,
          pointsByCategory: { awards: 1 },
        }),
        film({
          title: "BigAwards",
          filmSlug: "aw",
          totalPoints: 2,
          pointsByCategory: { awards: 50 },
        }),
      ],
      ["awards"],
    );

    expect(titleOrder()).toEqual(["BigTotal", "BigAwards"]);

    fireEvent.click(screen.getByRole("button", { name: /awards/ }));
    fireEvent.click(screen.getByRole("button", { name: /awards/ }));

    expect(titleOrder()).toEqual(["BigAwards", "BigTotal"]);
  });
});

describe("MFL films page", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("tells the member the catalogue is empty rather than showing a bare header row", () => {
    renderPage([], [metric("awards")]);

    expect(screen.getByText("No films in the catalogue yet.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("builds one column per distinct category the season defines", () => {
    renderPage(
      [film()],
      [metric("awards"), metric("awards"), metric("box_office")],
    );

    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers.filter((h) => h?.includes("awards"))).toHaveLength(1);
    expect(headers.filter((h) => h?.includes("box_office"))).toHaveLength(1);
  });

  it("surfaces a fetch failure instead of an empty catalogue message", () => {
    renderPage([], [], { error: "Failed to load movies" });

    expect(screen.getByText("Failed to load movies")).toBeInTheDocument();
    expect(
      screen.queryByText("No films in the catalogue yet."),
    ).not.toBeInTheDocument();
  });
});
