import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import UserComparison from "../components/UserComparison";
import { apiService } from "../services/api";

vi.mock("../services/api");

const USERS = [
  { username: "alice", displayName: "Alice" },
  { username: "bob", displayName: "Bob" },
  { username: "carol" },
];

let currentSearch = "";
const LocationProbe = () => {
  currentSearch = useLocation().search;
  return null;
};

function renderAt(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/compare${search}`]}>
      <Routes>
        <Route
          path="/compare"
          element={
            <>
              <UserComparison />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

const select1 = () =>
  screen.getByLabelText("Select User 1") as HTMLSelectElement;
const select2 = () =>
  screen.getByLabelText("Select User 2") as HTMLSelectElement;

async function waitForUsersLoaded() {
  await screen.findAllByRole("option", { name: "Alice" });
}

beforeEach(() => {
  vi.clearAllMocks();
  currentSearch = "";
  vi.mocked(apiService.getFilmUsers).mockResolvedValue({ data: USERS });
  vi.mocked(apiService.getFilmUserComplete).mockImplementation(
    async (username: string) => ({
      data: {
        username,
        displayName: null,
        followers: 0,
        following: 0,
        numberOfLists: 0,
        totalRatings: 0,
        totalWatched: 0,
        ratings: [],
        source: "db",
        success: true,
      },
    }),
  );
  vi.mocked(apiService.getMoviesInCommon).mockResolvedValue({
    data: {
      user1: "alice",
      user2: "bob",
      moviesInCommon: [],
      count: 0,
      compatibility: null,
    },
  } as never);
});

describe("UserComparison URL params", () => {
  it("runs the comparison on load when both params name known users", async () => {
    renderAt("?user1=alice&user2=bob");

    await waitFor(() => expect(select1().value).toBe("alice"));
    expect(select2().value).toBe("bob");
    await waitFor(() =>
      expect(apiService.getFilmUserComplete).toHaveBeenCalledWith("alice"),
    );
    expect(apiService.getFilmUserComplete).toHaveBeenCalledWith("bob");
  });

  it("folds mixed-case params onto the canonical lowercase username", async () => {
    renderAt("?user1=Alice&user2=BOB");

    await waitFor(() => expect(select1().value).toBe("alice"));
    expect(select2().value).toBe("bob");
    await waitFor(() => expect(currentSearch).toBe("?user1=alice&user2=bob"));
  });

  it.each([
    ["only user1", "?user1=alice"],
    ["only user2", "?user2=bob"],
    ["an unknown user", "?user1=alice&user2=nobody"],
    ["the same user twice", "?user1=alice&user2=alice"],
    ["an empty value", "?user1=&user2=bob"],
  ])("falls back to the empty page with %s", async (_label, search) => {
    renderAt(search);
    await waitForUsersLoaded();

    await waitFor(() => expect(currentSearch).toBe(""));
    expect(select1().value).toBe("");
    expect(select2().value).toBe("");
    expect(apiService.getFilmUserComplete).not.toHaveBeenCalled();
  });

  it("writes each selection to the URL", async () => {
    renderAt("");
    await waitForUsersLoaded();

    fireEvent.change(select1(), { target: { value: "alice" } });
    expect(currentSearch).toBe("?user1=alice");

    fireEvent.change(select2(), { target: { value: "carol" } });
    expect(currentSearch).toBe("?user1=alice&user2=carol");

    await waitFor(() => expect(select1()).toBeEnabled());
    fireEvent.change(select1(), { target: { value: "" } });
    expect(currentSearch).toBe("?user2=carol");
  });
});
