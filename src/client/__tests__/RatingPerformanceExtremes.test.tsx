import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RatingPerformanceExtremes from "../components/RatingPerformanceExtremes";
import type { RatingDifferentialFilm } from "../../shared/types";

const film = (
  slug: string,
  differential: number,
  average: number,
  lb: number,
): RatingDifferentialFilm => ({
  film_slug: slug,
  title: slug,
  average_rating: average,
  lb_rating: lb,
  differential,
  rating_count: 20,
});

const renderWith = (
  over: RatingDifferentialFilm[],
  under: RatingDifferentialFilm[],
) =>
  render(
    <MemoryRouter>
      <RatingPerformanceExtremes over={over} under={under} />
    </MemoryRouter>,
  );

describe("RatingPerformanceExtremes", () => {
  it("renders a signed differential and both underlying averages", () => {
    renderWith(
      [film("rear-window", 0.4, 4.8, 4.4)],
      [film("avatar", -0.5, 3.2, 3.7)],
    );

    expect(screen.getByText("+0.40")).toBeInTheDocument();
    expect(screen.getByText("-0.50")).toBeInTheDocument();
    expect(screen.getByText("Ours 4.80 · LB 4.40")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /rear-window/ }),
    ).toHaveAttribute("href", "/film/rear-window");
  });

  it("shows an empty message per side when there are no films", () => {
    renderWith([], []);
    expect(screen.getAllByText("No qualifying films yet.")).toHaveLength(2);
  });

  it("lists multiple tied films on one side", () => {
    renderWith(
      [
        film("a", 0.4, 4.4, 4.0),
        film("b", 0.4, 4.4, 4.0),
        film("c", 0.4, 4.4, 4.0),
      ],
      [],
    );
    expect(screen.getAllByText("+0.40")).toHaveLength(3);
  });
});
