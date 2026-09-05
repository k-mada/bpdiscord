import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DataTable } from "../components/DataTable/DataTable";
import { mflFilmSummaryColumns } from "../components/DataTable/columns";
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

function renderTable(films: MFLCatalogueFilm[]) {
  return render(
    <MemoryRouter>
      <DataTable
        data={films}
        columns={mflFilmSummaryColumns}
        enableSort
        initialSort={{ key: "price", direction: "desc" }}
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
  it("renders a null price and release date as TBA", () => {
    renderTable([film({ price: null, releaseDate: null })]);

    const cells = screen.getAllByRole("cell").map((c) => c.textContent);
    expect(cells.filter((c) => c === "TBA")).toHaveLength(2);
  });

  it("announces TBA as words rather than letters", () => {
    renderTable([film({ price: null, releaseDate: null })]);

    expect(screen.getAllByLabelText("to be announced")).toHaveLength(2);
  });

  it("formats a release date without letting a timezone shift the day", () => {
    renderTable([film({ releaseDate: "2026-01-01" })]);

    expect(screen.getByText("Jan 1, 2026")).toBeInTheDocument();
  });

  it("links the film cell to its breakdown", () => {
    renderTable([film()]);

    expect(screen.getByRole("link", { name: "Anora" })).toHaveAttribute(
      "href",
      "/mfl/film/anora",
    );
  });

  it("opens sorted by price, descending", () => {
    renderTable([
      film({ title: "Cheap", filmSlug: "cheap", price: 12 }),
      film({ title: "Dear", filmSlug: "dear", price: 48 }),
    ]);

    expect(titleOrder()).toEqual(["Dear", "Cheap"]);
  });

  it("sinks an unpriced film to the bottom of the default view", () => {
    // compareNullable puts nulls lowest ascending; descending negates that, so
    // "no price" lands last rather than leading the table.
    renderTable([
      film({ title: "Unpriced", filmSlug: "unpriced", price: null }),
      film({ title: "Cheap", filmSlug: "cheap", price: 12 }),
      film({ title: "Dear", filmSlug: "dear", price: 48 }),
    ]);

    expect(titleOrder()).toEqual(["Dear", "Cheap", "Unpriced"]);
  });
});

describe("MFL films page", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("tells the member the catalogue is empty rather than showing a bare header row", () => {
    renderPage([], [metric("awards")]);

    expect(
      screen.getByText("No films in the catalogue yet."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows only the four summary columns, never one per category", () => {
    // A season defines well over a hundred categories; a column each is why
    // this table was unusable.
    renderPage(
      [film({ pointsByCategory: { awards: 25, box_office: 10 } })],
      [metric("awards"), metric("box_office")],
    );

    const headers = screen
      .getAllByRole("columnheader")
      .map((h) => h.textContent?.replace(/[⇅▲▼]/g, "").trim());
    expect(headers).toEqual(["Film", "Released", "Price", "Total Points"]);
  });

  it("surfaces a fetch failure instead of an empty catalogue message", () => {
    renderPage([], [], { error: "Failed to load movies" });

    expect(screen.getByText("Failed to load movies")).toBeInTheDocument();
    expect(
      screen.queryByText("No films in the catalogue yet."),
    ).not.toBeInTheDocument();
  });
});
