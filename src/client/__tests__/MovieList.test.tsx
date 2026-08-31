import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MovieList from "../components/MovieList";
import type { LBFilm } from "../types";

const film: LBFilm = {
  film_slug: "heat",
  title: "Heat",
  watch_count: 3,
  rating_count: 3,
  average_rating: 4.5,
  poster: "",
  banner: "",
  tmdb_link: "",
  url: "",
};

describe("MovieList", () => {
  it("renders the empty message when there are no movies", () => {
    render(
      <MemoryRouter>
        <MovieList movies={[]} emptyMessage="Nothing here." />
      </MemoryRouter>,
    );

    expect(screen.getByText("Nothing here.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("renders the films when present", () => {
    render(
      <MemoryRouter>
        <MovieList movies={[film]} emptyMessage="Nothing here." />
      </MemoryRouter>,
    );

    expect(screen.queryByText("Nothing here.")).not.toBeInTheDocument();
    expect(screen.getByRole("list")).toBeInTheDocument();
  });

  it("links each poster to the internal film page", () => {
    render(
      <MemoryRouter>
        <MovieList movies={[film]} emptyMessage="Nothing here." />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link")).toHaveAttribute("href", "/film/heat");
  });

  // ★ and 👀 were the only thing telling a rating from a watch count, and
  // neither has a name a screen reader can read out.
  it("labels the rating and watch-count glyphs", () => {
    render(
      <MemoryRouter>
        <MovieList movies={[film]} showRating showCount />
      </MemoryRouter>,
    );

    // Rendered twice: the hover overlay and the static line below the poster,
    // one of which CSS hides at any given breakpoint.
    expect(screen.getAllByText("Average rating")).not.toHaveLength(0);
    expect(screen.getAllByText("Watched by")).not.toHaveLength(0);
  });
});
