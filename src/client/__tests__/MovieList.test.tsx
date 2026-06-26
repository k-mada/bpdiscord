import { render, screen } from "@testing-library/react";
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
    render(<MovieList movies={[]} emptyMessage="Nothing here." />);

    expect(screen.getByText("Nothing here.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("renders the films when present", () => {
    render(<MovieList movies={[film]} emptyMessage="Nothing here." />);

    expect(screen.queryByText("Nothing here.")).not.toBeInTheDocument();
    expect(screen.getByRole("list")).toBeInTheDocument();
  });
});
