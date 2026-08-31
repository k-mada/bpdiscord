import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Stats from "../components/Stats";
import Dashboard from "../components/Dashboard";
import UserProfile from "../components/UserProfile";
import { apiService } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import type { FilmUserComplete } from "../types";

vi.mock("../hooks/useTopFilmsByYear", () => ({
  useTopFilmsByYear: () => ({
    topRated: [],
    topWatched: [],
    loading: false,
    error: null,
  }),
}));
vi.mock("../hooks/useRatingsDistribution", () => ({
  useRatingsDistribution: () => ({ data: [], loading: false, error: null }),
}));
vi.mock("../hooks/useUserFilmsCount", () => ({
  useUserFilmsCount: () => ({ data: 42, loading: false, error: null }),
}));
vi.mock("../contexts/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../services/api", () => ({
  apiService: {
    getFilmUserComplete: vi.fn(),
    getCompatibilityExtremes: vi.fn(),
  },
}));
vi.mock("../components/CompareWithUser", () => ({ default: () => null }));
vi.mock("../components/CompatibilityExtremes", () => ({ default: () => null }));

const profile: FilmUserComplete = {
  username: "alice",
  displayName: "Alice",
  followers: 3,
  following: 4,
  numberOfLists: 1,
  totalRatings: 9,
  totalWatched: 12,
  ratings: [{ rating: 4, count: 3 }],
  source: "db",
  success: true,
};

// A screen reader user navigates by heading. A jump from h1 to h3 reads as a
// missing section, and a page with no h1 has no root to jump to.
const levels = () =>
  screen
    .getAllByRole("heading")
    .map((h) => Number(h.tagName.slice(1)))
    .filter((level) => !Number.isNaN(level));

// expected is the heading count, so the walk below cannot pass vacuously on a
// page that rendered its loading branch instead of its content.
const expectNoSkippedLevels = (expected: number) => {
  const found = levels();
  expect(found).toHaveLength(expected);
  expect(found.filter((level) => level === 1)).toHaveLength(1);
  expect(found[0]).toBe(1);
  found.reduce((previous, level) => {
    expect(level).toBeLessThanOrEqual(previous + 1);
    return level;
  }, 1);
};

describe("heading hierarchy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts Stats at h1 and skips no level", () => {
    render(
      <MemoryRouter>
        <Stats />
      </MemoryRouter>,
    );

    expectNoSkippedLevels(5);
  });

  it("starts Dashboard at h1 and skips no level", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: "1",
        email: "a@b.test",
        role: "admin",
        lbusername: "alice",
        displayName: "Alice",
      },
      loading: false,
    } as ReturnType<typeof useAuth>);

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    expectNoSkippedLevels(6);
  });

  // The display name was an h2 with nothing above it, so the profile had no
  // root heading at all rather than a skipped one.
  it("makes the profile display name the page h1", async () => {
    vi.mocked(apiService.getFilmUserComplete).mockResolvedValue({
      data: profile,
    });

    render(
      <MemoryRouter initialEntries={["/user/alice"]}>
        <Routes>
          <Route path="/user/:username" element={<UserProfile />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        "Alice",
      ),
    );
    expectNoSkippedLevels(1);
  });
});
