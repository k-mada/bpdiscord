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
});
