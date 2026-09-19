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
  it("renders rank, member and points", () => {
    renderTable([entry({ rank: 2, lbusername: "kevin", displayName: "kevin", totalPoints: 98 })]);

    expect(rowCells()).toEqual([["2", "kevin", "98"]]);
  });

  it("links the member to their profile page", () => {
    renderTable([entry({ lbusername: "rooney", displayName: "Rooney" })]);

    expect(screen.getByRole("link", { name: "Rooney" })).toHaveAttribute(
      "href",
      "/user/rooney",
    );
  });

  it("falls back to the lbusername when the display name is missing", () => {
    renderTable([entry({ lbusername: "no_name", displayName: null })]);

    expect(screen.getByRole("link", { name: "no_name" })).toHaveAttribute(
      "href",
      "/user/no_name",
    );
  });

  it("shows tied members with the same rank", () => {
    renderTable([
      entry({ rank: 1, lbusername: "rooney", displayName: "Rooney", totalPoints: 143 }),
      entry({ rank: 2, lbusername: "alice", displayName: "alice", totalPoints: 98 }),
      entry({ rank: 2, lbusername: "kevin", displayName: "kevin", totalPoints: 98 }),
      entry({ rank: 4, lbusername: "bob", displayName: "bob", totalPoints: 0 }),
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

  it("renders the ranked members when standings load", () => {
    renderPage({
      leaderboard: [
        entry({ rank: 1, lbusername: "rooney", displayName: "Rooney", totalPoints: 143 }),
      ],
    });

    expect(screen.getByRole("link", { name: "Rooney" })).toHaveAttribute(
      "href",
      "/user/rooney",
    );
  });
});
