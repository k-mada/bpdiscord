import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import Stats from "../components/Stats";
import { useTopFilmsByYear } from "../hooks/useTopFilmsByYear";
import type { LBFilm } from "../types";

vi.mock("../hooks/useTopFilmsByYear", () => ({
  useTopFilmsByYear: vi.fn(),
}));

vi.mock("../hooks/useRatingsDistribution", () => ({
  useRatingsDistribution: () => ({ data: [], loading: false, error: null }),
}));

vi.mock("../components/UserFilmsCount", () => ({
  default: () => <div data-testid="user-films-count" />,
}));

const mockUseTopFilmsByYear = vi.mocked(useTopFilmsByYear);

const film = (slug: string): LBFilm => ({
  film_slug: slug,
  title: slug,
  watch_count: 3,
  rating_count: 3,
  average_rating: 4,
  poster: "",
  banner: "",
  tmdb_link: "",
  url: "",
});

const withFilms = () =>
  mockUseTopFilmsByYear.mockReturnValue({
    topRated: [film("a")],
    topWatched: [film("b")],
    loading: false,
    error: null,
  });

const withNoFilms = () =>
  mockUseTopFilmsByYear.mockReturnValue({
    topRated: [],
    topWatched: [],
    loading: false,
    error: null,
  });

// createMemoryRouter is unusable here: the data router builds a Request, and
// jsdom's AbortSignal is not undici's, so every navigation rejects.
const LocationProbe = () => {
  const { search } = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <span data-testid="search">{search}</span>
      <button onClick={() => navigate(-1)}>go back</button>
    </>
  );
};

const renderAt = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Stats />
      <LocationProbe />
    </MemoryRouter>,
  );

const yearSelect = () => screen.getByLabelText("Filter top films by year:");
const search = () => screen.getByTestId("search").textContent;
const goBack = () =>
  userEvent.click(screen.getByRole("button", { name: "go back" }));

describe("Stats year URL parameter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withFilms();
  });

  it("shows all years and fetches unscoped when no year param is present", () => {
    renderAt("/");

    expect(yearSelect()).toHaveValue("");
    expect(mockUseTopFilmsByYear).toHaveBeenCalledWith(null);
  });

  it("preselects the dropdown and fetches that year on a direct deep link", () => {
    renderAt("/?year=2023");

    expect(yearSelect()).toHaveValue("2023");
    expect(mockUseTopFilmsByYear).toHaveBeenCalledWith(2023);
  });

  it("keeps the year-scoped headings in sync with the URL param", () => {
    renderAt("/?year=2023");

    expect(
      screen.getByText("Top rated movies of 2023 (5+ ratings)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Most watched movies of 2023")).toBeInTheDocument();
  });

  it("keeps the year-scoped empty messages in sync with the URL param", () => {
    withNoFilms();
    renderAt("/?year=2023");

    expect(
      screen.getByText("No films released in 2023 have enough ratings yet."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No films released in 2023 watched yet."),
    ).toBeInTheDocument();
  });

  it("keeps the all-time headings and empty messages when no year is set", () => {
    withNoFilms();
    renderAt("/");

    expect(
      screen.getByText("Our highest rated movies (20+ ratings)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Our most watched movies")).toBeInTheDocument();
    expect(screen.getByText("No rated films yet.")).toBeInTheDocument();
    expect(screen.getByText("No watched films yet.")).toBeInTheDocument();
  });

  it("writes the selected year to the URL", async () => {
    renderAt("/");

    await userEvent.selectOptions(yearSelect(), "2021");

    await waitFor(() => expect(search()).toBe("?year=2021"));
    expect(mockUseTopFilmsByYear).toHaveBeenLastCalledWith(2021);
  });

  it("removes the param entirely when returning to all years", async () => {
    renderAt("/?year=2021");

    await userEvent.selectOptions(yearSelect(), "");

    await waitFor(() => expect(search()).toBe(""));
    expect(mockUseTopFilmsByYear).toHaveBeenLastCalledWith(null);
  });

  it("preserves unrelated query params when the year changes", async () => {
    renderAt("/?tab=rated");

    await userEvent.selectOptions(yearSelect(), "2021");

    await waitFor(() => expect(search()).toBe("?tab=rated&year=2021"));
  });

  it("pushes history so Back returns to the previously selected year", async () => {
    renderAt("/");

    await userEvent.selectOptions(yearSelect(), "2023");
    await waitFor(() => expect(search()).toBe("?year=2023"));

    await userEvent.selectOptions(yearSelect(), "2021");
    await waitFor(() => expect(search()).toBe("?year=2021"));

    await goBack();

    await waitFor(() => expect(search()).toBe("?year=2023"));
    expect(yearSelect()).toHaveValue("2023");
    expect(mockUseTopFilmsByYear).toHaveBeenLastCalledWith(2023);
  });

  it.each([
    ["not a number", "/?year=abc"],
    ["before the first option", "/?year=1800"],
    ["after the last option", `/?year=${new Date().getFullYear() + 1}`],
    ["not an integer", "/?year=2021.5"],
    ["empty", "/?year="],
  ])("falls back to all years when the param is %s", (_label, entry) => {
    renderAt(entry);

    expect(yearSelect()).toHaveValue("");
    expect(mockUseTopFilmsByYear).toHaveBeenCalledWith(null);
  });

  it("marks the results region busy while a new year loads", () => {
    mockUseTopFilmsByYear.mockReturnValue({
      topRated: [film("a")],
      topWatched: [film("b")],
      loading: true,
      error: null,
    });
    renderAt("/?year=2023");

    expect(
      screen.getByRole("tabpanel", { name: "Highest rated" }).parentElement,
    ).toHaveAttribute("aria-busy", "true");
  });
});
