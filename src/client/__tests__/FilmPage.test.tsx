import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import FilmPage from "../components/FilmPage";
import { apiService } from "../services/api";
import type { FilmDetail } from "../../shared/types";

vi.mock("../services/api", () => ({
  apiService: {
    getFilmDetail: vi.fn(),
  },
}));

const mockGet = vi.mocked(apiService.getFilmDetail);

const poster =
  "https://a.ltrbxd.com/resized/film-poster/1/2/3/heat-0-230-0-345-crop.jpg";

const film: FilmDetail = {
  filmSlug: "heat",
  title: "Heat",
  releaseYear: 1995,
  poster,
  letterboxdUrl: null,
  letterboxdRating: 4.3,
  watchedCount: 5,
  ratedCount: 2,
  averageRating: 4.25,
  ratings: [
    { username: "alice", displayName: "Alice", rating: 4.5, liked: true },
    { username: "bob", displayName: null, rating: 4.0, liked: false },
  ],
};

const renderPage = (entry = "/film/heat") =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/film/:filmSlug" element={<FilmPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe("FilmPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ data: film });
  });

  it("renders the title, year and stats", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Heat" }),
    ).toBeInTheDocument();
    expect(screen.getByText("1995")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("4.25")).toBeInTheDocument();
    expect(screen.getByText("4.30")).toBeInTheDocument();
  });

  it("links the poster to the film's Letterboxd page", async () => {
    renderPage();

    const link = await screen.findByRole("link", {
      name: "View Heat on Letterboxd",
    });
    expect(link).toHaveAttribute("href", "https://letterboxd.com/film/heat/");
  });

  it("requests poster crops larger than the stored 230px one", async () => {
    renderPage();

    const img = await screen.findByAltText("Heat poster");
    expect(img).toHaveAttribute(
      "src",
      expect.stringContaining("-0-400-0-600-"),
    );
    expect(img).toHaveAttribute(
      "srcset",
      expect.stringContaining("-0-600-0-900-crop.jpg 600w"),
    );
  });

  it("falls back to the stored poster when a resized crop fails to load", async () => {
    renderPage();

    const img = await screen.findByAltText("Heat poster");
    fireEvent.error(img);

    await waitFor(() => expect(img).toHaveAttribute("src", poster));
    expect(img).not.toHaveAttribute("srcset");
  });

  it("lists raters in the order the API returned them", async () => {
    renderPage();

    const raters = await screen.findAllByRole("link", { name: /Alice|bob/ });
    expect(raters.map((r) => r.textContent)).toEqual(["Alice", "bob"]);
    expect(raters[0]).toHaveAttribute("href", "/user/alice");
    expect(screen.getByLabelText("4.5 out of 5 stars")).toBeInTheDocument();
  });

  it("renders an em dash when the film has no Letterboxd average", async () => {
    mockGet.mockResolvedValue({
      data: { ...film, letterboxdRating: null, averageRating: null },
    });
    renderPage();

    await screen.findByRole("heading", { level: 1, name: "Heat" });
    expect(screen.getAllByText("—")).toHaveLength(2);
  });

  it("explains the gap when the film is watched but unrated", async () => {
    mockGet.mockResolvedValue({
      data: { ...film, ratedCount: 0, averageRating: null, ratings: [] },
    });
    renderPage();

    expect(
      await screen.findByText("No ratings yet — 5 people have logged it."),
    ).toBeInTheDocument();
  });

  it("explains an empty page when nobody in the Discord logged the film", async () => {
    mockGet.mockResolvedValue({
      data: {
        ...film,
        watchedCount: 0,
        ratedCount: 0,
        averageRating: null,
        ratings: [],
      },
    });
    renderPage();

    expect(
      await screen.findByText(
        "Nobody in the Discord has logged this film yet.",
      ),
    ).toBeInTheDocument();
  });

  it("reads includeNonDiscord from the query string", async () => {
    renderPage("/film/heat?includeNonDiscord=true");

    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith(
        "heat",
        { includeNonDiscord: true },
        expect.any(AbortSignal),
      ),
    );
  });

  it("renders the error card when the request genuinely fails", async () => {
    mockGet.mockRejectedValue(new Error("network down"));
    renderPage();

    expect(await screen.findByText("Failed to load film")).toBeInTheDocument();
  });

  // Navigating between two films reuses the FilmPage instance, so a poster
  // failure recorded as a bare boolean used to persist for the whole session.
  it("re-enables upscaling for the next film after one poster fails", async () => {
    render(
      <MemoryRouter initialEntries={["/film/heat"]}>
        <Link to="/film/collateral">next</Link>
        <Routes>
          <Route path="/film/:filmSlug" element={<FilmPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const img = await screen.findByAltText("Heat poster");
    fireEvent.error(img);
    await waitFor(() => expect(img).toHaveAttribute("src", poster));

    mockGet.mockResolvedValue({
      data: {
        ...film,
        filmSlug: "collateral",
        title: "Collateral",
        poster: poster.replace("heat", "collateral"),
      },
    });
    fireEvent.click(screen.getByRole("link", { name: "next" }));

    const nextImg = await screen.findByAltText("Collateral poster");
    expect(nextImg).toHaveAttribute(
      "src",
      expect.stringContaining("-0-400-0-600-"),
    );
  });

  it("marks films a user liked", async () => {
    renderPage();

    expect(await screen.findAllByLabelText("liked")).toHaveLength(1);
  });

  it("renders the not-found page for an unknown slug", async () => {
    const { ApiError } = await import("../lib/apiError");
    mockGet.mockRejectedValue(new ApiError("nope", 404));
    renderPage("/film/ghost");

    expect(await screen.findByText(/No film for "ghost"/)).toBeInTheDocument();
  });
});
