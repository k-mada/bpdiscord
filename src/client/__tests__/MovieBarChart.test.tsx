import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MovieBarChart from "../components/MovieBarChart";
import type { LBFilm } from "../types";

const film: LBFilm = {
  film_slug: "heat",
  title: "Heat",
  watch_count: 1234,
  rating_count: 3,
  average_rating: 4.5,
  poster: "",
  banner: "",
  tmdb_link: "",
  url: "",
};

describe("MovieBarChart", () => {
  it("renders the empty message when there are no movies", () => {
    render(
      <MemoryRouter>
        <MovieBarChart movies={[]} emptyMessage="Nothing here." />
      </MemoryRouter>,
    );

    expect(screen.getByText("Nothing here.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("renders a rating bar with the formatted rating and film link", () => {
    render(
      <MemoryRouter>
        <MovieBarChart movies={[film]} showRating animated={false} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getByText("Heat")).toBeInTheDocument();
    expect(screen.getByText("4.50")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/film/heat");
  });

  it("renders a watch-count bar with the localized count", () => {
    render(
      <MemoryRouter>
        <MovieBarChart movies={[film]} showCount animated={false} />
      </MemoryRouter>,
    );

    expect(screen.getByText("1,234")).toBeInTheDocument();
  });

  it("numbers the rows by position when showRank is set", () => {
    const second: LBFilm = { ...film, film_slug: "collateral", title: "Collateral" };
    render(
      <MemoryRouter>
        <MovieBarChart movies={[film, second]} showCount showRank animated={false} />
      </MemoryRouter>,
    );

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("omits rank numbers by default", () => {
    render(
      <MemoryRouter>
        <MovieBarChart movies={[film]} showCount animated={false} />
      </MemoryRouter>,
    );

    expect(screen.queryByText("1")).not.toBeInTheDocument();
  });

  it("sqrt scale lifts mid bars above linear while pinning min and max", () => {
    const films: LBFilm[] = [30, 45, 400].map((n, i) => ({
      ...film,
      film_slug: `f${i}`,
      title: `F${i}`,
      watch_count: n,
    }));

    const barWidths = (scale: "linear" | "sqrt") => {
      const { container, unmount } = render(
        <MemoryRouter>
          <MovieBarChart
            movies={films}
            showCount
            scale={scale}
            floorPct={50}
            animated={false}
          />
        </MemoryRouter>,
      );
      const widths = Array.from(
        container.querySelectorAll<HTMLElement>('[style*="--bar-w"]'),
      ).map((el) => parseFloat(el.style.getPropertyValue("--bar-w")));
      unmount();
      return widths;
    };

    const linear = barWidths("linear");
    const sqrt = barWidths("sqrt");

    expect(sqrt[0]).toBeCloseTo(50);
    expect(sqrt[2]).toBeCloseTo(100);
    expect(linear[0]).toBeCloseTo(50);
    expect(linear[2]).toBeCloseTo(100);
    expect(sqrt[1]!).toBeGreaterThan(linear[1]!);
  });
});
