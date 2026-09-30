import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { axeViolations } from "./helpers/axe";
import MostWatchedFilms from "../components/MostWatchedFilms";
import { apiService } from "../services/api";
import type { LBFilm } from "../types";

vi.mock("../services/api");

const film = (over: Partial<LBFilm>): LBFilm => ({
  film_slug: "heat",
  title: "Heat",
  watch_count: 42,
  rating_count: 40,
  average_rating: 4.5,
  poster: "https://example.test/heat.jpg",
  banner: "",
  tmdb_link: "",
  url: "",
  ...over,
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <MostWatchedFilms />
    </MemoryRouter>,
  );

describe("MostWatchedFilms", () => {
  it("renders a poster grid of linked films with accessible names", async () => {
    vi.mocked(apiService.getMostWatchedFilms).mockResolvedValue({
      data: [
        film({ film_slug: "heat", title: "Heat" }),
        film({ film_slug: "collateral", title: "Collateral", poster: "" }),
      ],
    });

    const { container } = renderPage();

    const heat = await screen.findByRole("link", { name: "Heat" });
    expect(heat).toHaveAttribute("href", "/film/heat");
    // A posterless film still names its link via the fallback tile.
    expect(screen.getByRole("link", { name: "Collateral" })).toHaveAttribute(
      "href",
      "/film/collateral",
    );
    expect(await axeViolations(container)).toEqual([]);
  });

  it("shows the empty message when no film qualifies", async () => {
    vi.mocked(apiService.getMostWatchedFilms).mockResolvedValue({ data: [] });

    renderPage();

    await waitFor(() =>
      expect(screen.getByText("No film has 40 watchers yet.")).toBeInTheDocument(),
    );
  });

  it("surfaces an error when the request fails", async () => {
    vi.mocked(apiService.getMostWatchedFilms).mockResolvedValue({
      error: "boom",
    });

    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Failed to load most watched films",
    );
  });
});
