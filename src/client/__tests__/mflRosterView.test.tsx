import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import RosterView from "../components/MovieFantasyLeague/RosterView";
import apiService from "../services/api";
import { ApiError } from "../lib/apiError";
import type { MFLRosterView } from "../types";

vi.mock("../services/api");
vi.mock("../components/Spinner", () => ({
  default: () => <div data-testid="spinner" />,
}));

const VIEW: MFLRosterView = {
  rosterId: 7,
  name: "My Movie Picks",
  lbusername: "rooney",
  displayName: "Rooney",
  totalPoints: 55,
  picks: [
    { filmSlug: "anora", title: "Anora", releaseDate: "2026-10-18", price: 40, totalPoints: 30 },
    { filmSlug: "hamnet", title: "Hamnet", releaseDate: null, price: null, totalPoints: 25 },
  ],
};

function renderView(rosterId = "7") {
  return render(
    <MemoryRouter initialEntries={[`/mfl/roster/${rosterId}`]}>
      <Routes>
        <Route path="/mfl/roster/:rosterId" element={<RosterView />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MFL roster view", () => {
  it("lists each film with its price and points, and the roster total", async () => {
    vi.mocked(apiService.getMflRosterView).mockResolvedValue({ data: VIEW });
    renderView("7");

    expect(await screen.findByText("My Movie Picks")).toBeInTheDocument();
    expect(apiService.getMflRosterView).toHaveBeenCalledWith(7, expect.anything());

    const anora = screen.getByText("Anora").closest("tr")!;
    expect(within(anora).getByText("$40")).toBeInTheDocument();
    expect(within(anora).getByText("30")).toBeInTheDocument();

    // A null price renders a dash rather than "$null".
    const hamnet = screen.getByText("Hamnet").closest("tr")!;
    expect(within(hamnet).getByText("—")).toBeInTheDocument();

    const totalRow = screen.getByText("Total points").closest("tr")!;
    expect(within(totalRow).getByText("55")).toBeInTheDocument();
  });

  it("links the owner to their profile", async () => {
    vi.mocked(apiService.getMflRosterView).mockResolvedValue({ data: VIEW });
    renderView("7");

    expect(await screen.findByRole("link", { name: "Rooney" })).toHaveAttribute(
      "href",
      "/user/rooney",
    );
  });

  it("shows a not-found message on a 404 rather than a generic error", async () => {
    vi.mocked(apiService.getMflRosterView).mockRejectedValue(
      new ApiError("Roster not found", 404),
    );
    renderView("999");

    expect(await screen.findByText("Roster not found.")).toBeInTheDocument();
  });

  it("tells the viewer an empty roster has no films", async () => {
    vi.mocked(apiService.getMflRosterView).mockResolvedValue({
      data: { ...VIEW, picks: [], totalPoints: 0 },
    });
    renderView("7");

    expect(
      await screen.findByText("This roster has no films yet."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("surfaces a generic failure", async () => {
    vi.mocked(apiService.getMflRosterView).mockRejectedValue(
      new ApiError("boom", 500),
    );
    renderView("7");

    expect(await screen.findByText("Failed to load this roster")).toBeInTheDocument();
  });
});
