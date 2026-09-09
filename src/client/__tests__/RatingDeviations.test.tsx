import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RatingDeviations from "../components/RatingDeviations";
import type { RatingDeviationFilm } from "../../shared/types";

const film = (
  slug: string,
  deviation: number,
  average: number,
  lb: number,
): RatingDeviationFilm => ({
  film_slug: slug,
  title: slug,
  average_rating: average,
  lb_rating: lb,
  deviation,
  rating_count: 20,
});

// The server scopes each side by sign, so `over` only ever holds positive-
// deviation films and `under` only negative — the tests honour that contract.
const renderWith = (
  over: RatingDeviationFilm[],
  under: RatingDeviationFilm[],
) =>
  render(
    <MemoryRouter>
      <RatingDeviations over={over} under={under} />
    </MemoryRouter>,
  );

describe("RatingDeviations", () => {
  it("renders a signed deviation and both underlying averages", () => {
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

  it("labels each column for assistive tech", () => {
    renderWith(
      [film("rear-window", 0.4, 4.8, 4.4)],
      [film("avatar", -0.5, 3.2, 3.7)],
    );

    expect(
      screen.getByRole("group", {
        name: "Films rated above their Letterboxd average",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", {
        name: "Films rated below their Letterboxd average",
      }),
    ).toBeInTheDocument();
  });

  it("shows a single no-data message when there are no qualifying films", () => {
    renderWith([], []);
    expect(
      screen.getByText("Not enough ratings this year to compare."),
    ).toBeInTheDocument();
  });

  it("shows the over message when no film beat its Letterboxd average", () => {
    renderWith([], [film("the-searchers", -0.54, 3.4, 3.94)]);

    expect(
      screen.getByText("No film averaged above its Letterboxd rating."),
    ).toBeInTheDocument();
    expect(screen.getByText("-0.54")).toBeInTheDocument();
  });

  it("shows the under message when no film trailed its Letterboxd average", () => {
    renderWith([film("a", 0.6, 4.6, 4.0)], []);

    expect(
      screen.getByText("No film averaged below its Letterboxd rating."),
    ).toBeInTheDocument();
    expect(screen.getByText("+0.60")).toBeInTheDocument();
  });

  it("lists multiple tied films on one side", () => {
    renderWith(
      [
        film("a", 0.4, 4.4, 4.0),
        film("b", 0.4, 4.4, 4.0),
        film("c", 0.4, 4.4, 4.0),
      ],
      [film("d", -0.3, 3.7, 4.0)],
    );
    expect(screen.getAllByText("+0.40")).toHaveLength(3);
  });
});
