import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DataTable } from "../components/DataTable/DataTable";
import { mflLeaderboardColumns } from "../components/DataTable/columns";
import MovieFantasyLeague from "../components/MovieFantasyLeague/Dashboard";
import { useMflData } from "../hooks/useMflData";
import { useMflLeaderboard } from "../hooks/useMflLeaderboard";
import type { MFLLeaderboardEntry } from "../types";

vi.mock("../hooks/useMflData");
vi.mock("../hooks/useMflLeaderboard");

function entry(over: Partial<MFLLeaderboardEntry> = {}): MFLLeaderboardEntry {
  return {
    rank: 1,
    rosterId: 1,
    name: "My Picks",
    lbusername: "rooney",
    displayName: "Rooney",
    totalPoints: 143,
    ...over,
  };
}

function renderTable(rows: MFLLeaderboardEntry[]) {
  return render(
    <MemoryRouter>
      <DataTable
        data={rows}
        columns={mflLeaderboardColumns}
        enableSort
        initialSort={{ key: "rank", direction: "asc" }}
      />
    </MemoryRouter>,
  );
}

/** Cell text per row, header row skipped. */
function rowCells() {
  return screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell").map((c) => c.textContent));
}

function renderPage(
  over: { leaderboard?: MFLLeaderboardEntry[]; loading?: boolean; error?: string | null } = {},
) {
  vi.mocked(useMflData).mockReturnValue({
    movies: [],
    scoringMetrics: [],
    loading: false,
    error: null,
  } as unknown as ReturnType<typeof useMflData>);
  vi.mocked(useMflLeaderboard).mockReturnValue({
    leaderboard: over.leaderboard ?? [],
    loading: over.loading ?? false,
    error: over.error ?? null,
  });

  return render(
    <MemoryRouter>
      <MovieFantasyLeague />
    </MemoryRouter>,
  );
}

describe("MFL leaderboard columns", () => {
  it("renders rank, the roster name with the owner in parentheses, and points", () => {
    renderTable([
      entry({ rank: 2, name: "Contenders", lbusername: "kevin", totalPoints: 98 }),
    ]);

    expect(rowCells()).toEqual([["2", "Contenders (kevin)", "98"]]);
  });

  it("links the roster to the owner's profile page", () => {
    renderTable([entry({ name: "My Movie Picks", lbusername: "rooney" })]);

    expect(
      screen.getByRole("link", { name: "My Movie Picks (rooney)" }),
    ).toHaveAttribute("href", "/user/rooney");
  });

  it("gives a user's two rosters their own rows", () => {
    renderTable([
      entry({ rank: 1, rosterId: 1, name: "A List", lbusername: "rooney", totalPoints: 143 }),
      entry({ rank: 2, rosterId: 2, name: "Backup", lbusername: "rooney", totalPoints: 98 }),
    ]);

    expect(rowCells()).toEqual([
      ["1", "A List (rooney)", "143"],
      ["2", "Backup (rooney)", "98"],
    ]);
  });

  it("shows tied rosters with the same rank", () => {
    renderTable([
      entry({ rank: 1, rosterId: 1, name: "A", lbusername: "rooney", totalPoints: 143 }),
      entry({ rank: 2, rosterId: 2, name: "B", lbusername: "alice", totalPoints: 98 }),
      entry({ rank: 2, rosterId: 3, name: "C", lbusername: "kevin", totalPoints: 98 }),
      entry({ rank: 4, rosterId: 4, name: "D", lbusername: "bob", totalPoints: 0 }),
    ]);

    expect(rowCells().map((cells) => cells[0])).toEqual(["1", "2", "2", "4"]);
  });
});

describe("MFL standings section", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("tells the member there are no standings rather than an empty table", () => {
    renderPage({ leaderboard: [] });

    expect(screen.getByText("No standings yet.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Standings" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("surfaces a fetch failure instead of the empty message", () => {
    renderPage({ error: "Failed to load standings" });

    expect(screen.getByText("Failed to load standings")).toBeInTheDocument();
    expect(screen.queryByText("No standings yet.")).not.toBeInTheDocument();
  });

  it("renders the ranked rosters when standings load", () => {
    renderPage({
      leaderboard: [
        entry({ rank: 1, name: "My Movie Picks", lbusername: "rooney", totalPoints: 143 }),
      ],
    });

    expect(
      screen.getByRole("link", { name: "My Movie Picks (rooney)" }),
    ).toHaveAttribute("href", "/user/rooney");
  });
});
