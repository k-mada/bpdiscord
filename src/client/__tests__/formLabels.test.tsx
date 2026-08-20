import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MovieSwapPage from "../components/MovieSwapPage";
import CompareWithUser from "../components/CompareWithUser";
import MovieSelector from "../components/MovieFantasyLeague/MovieSelector";
import CreateEventForm from "../components/events/CreateEventForm";
import { apiService } from "../services/api";

vi.mock("../hooks/useAwardShows", () => ({
  useAwardShows: () => ({
    awardShows: [{ id: "1", name: "Academy Awards" }],
    loading: false,
    error: null,
    refetch: vi.fn(),
    createAwardShow: vi.fn(),
  }),
}));

vi.mock("../services/api", () => ({
  apiService: {
    getFilmUsers: vi.fn(),
    getFilmUserComplete: vi.fn(),
    getMoviesInCommon: vi.fn(),
  },
}));

const USERS = [
  { username: "alice", displayName: "Alice" },
  { username: "bob", displayName: "Bob" },
];

// getByLabelText resolves only through a real label→control association, so
// these fail the moment an htmlFor/id pair is dropped.
describe("form control labelling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiService.getFilmUsers).mockResolvedValue({ data: USERS });
  });

  it("labels both Movie Swap selects", async () => {
    render(
      <MemoryRouter>
        <MovieSwapPage />
      </MemoryRouter>,
    );
    expect(await screen.findByLabelText("Select User 1")).toHaveProperty(
      "tagName",
      "SELECT",
    );
    expect(screen.getByLabelText("Select User 2")).toBeInTheDocument();
  });

  it("labels the CompareWithUser select", async () => {
    render(
      <MemoryRouter>
        <CompareWithUser baseUsername="alice" />
      </MemoryRouter>,
    );
    expect(await screen.findByLabelText("Select a user")).toBeInTheDocument();
  });

  it("labels the MovieSelector select", () => {
    render(
      <MovieSelector
        movies={[{ title: "Anatomy of a Fall", filmSlug: "anatomy" }]}
        onMovieSelect={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Select a movie")).toBeInTheDocument();
  });

  it.each([
    "Award Show",
    "Slug (URL-friendly)",
    "Year",
    "Edition Number",
    "Nominations Date",
    "Awards Date",
  ])("labels the %s field on CreateEventForm", (label) => {
    render(
      <CreateEventForm token="t" onSuccess={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByLabelText(label)).toBeInTheDocument();
  });

  // Two instances on the same page must not collide on a hardcoded id.
  it("gives each MovieSelector instance its own id", () => {
    render(
      <>
        <MovieSelector movies={[]} onMovieSelect={vi.fn()} />
        <MovieSelector movies={[]} onMovieSelect={vi.fn()} />
      </>,
    );
    const [a, b] = screen.getAllByLabelText("Select a movie");
    expect(a!.id).toBeTruthy();
    expect(a!.id).not.toBe(b!.id);
  });
});
