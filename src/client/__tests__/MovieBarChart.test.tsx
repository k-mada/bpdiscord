import { render, screen } from "@testing-library/react";
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
    render(<MovieBarChart movies={[]} emptyMessage="Nothing here." />);

    expect(screen.getByText("Nothing here.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("renders a rating bar with the formatted rating and film link", () => {
    render(<MovieBarChart movies={[film]} showRating animated={false} />);

    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getByText("Heat")).toBeInTheDocument();
    expect(screen.getByText("4.50")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "https://letterboxd.com/film/heat",
    );
  });

  it("renders a watch-count bar with the localized count", () => {
    render(<MovieBarChart movies={[film]} showCount animated={false} />);

    expect(screen.getByText("1,234")).toBeInTheDocument();
  });
});
