import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import MyPicks from "../components/MovieFantasyLeague/MyPicks";
import apiService from "../services/api";
import { AuthProvider } from "../contexts/AuthContext";
import { ApiError } from "../lib/apiError";
import type { CurrentUser, MFLPick } from "../types";
import { installFakeLocalStorage } from "./helpers/localStorage";
import { futureJwt } from "./helpers/jwt";

const TOKEN = futureJwt();

vi.mock("../services/api");
vi.mock("../components/Spinner", () => ({
  default: () => <div data-testid="spinner" />,
}));

const LINKED: CurrentUser = {
  id: "auth-uuid",
  email: "rooney@example.com",
  role: null,
  lbusername: "rooney",
  displayName: "Rooney",
};

const UNLINKED: CurrentUser = { ...LINKED, lbusername: null };

const ANORA: MFLPick = {
  filmSlug: "anora",
  title: "Anora",
  releaseDate: "2026-10-18",
  price: 40,
  totalPoints: 25,
};

const HAMNET: MFLPick = {
  filmSlug: "hamnet",
  title: "Hamnet",
  releaseDate: null,
  price: null,
  totalPoints: 10,
};

const CATALOGUE = [
  { ...ANORA, pointsByCategory: {} },
  { ...HAMNET, pointsByCategory: {} },
  {
    filmSlug: "sinners",
    title: "Sinners",
    releaseDate: "2026-03-07",
    price: 22,
    totalPoints: 0,
    pointsByCategory: {},
  },
];

function renderPage() {
  return render(
    <AuthProvider>
      <MemoryRouter>
        <MyPicks />
      </MemoryRouter>
    </AuthProvider>,
  );
}

function setPicks(picks: MFLPick[], rosterTotal: number) {
  vi.mocked(apiService.getMflPicks).mockResolvedValue({
    data: { picks, rosterTotal },
  });
}

beforeEach(() => {
  installFakeLocalStorage();
  localStorage.setItem("token", TOKEN);
  vi.clearAllMocks();
  vi.mocked(apiService.getCurrentUser).mockResolvedValue({ data: LINKED });
  vi.mocked(apiService.getMflScoringMetrics).mockResolvedValue({ data: [] });
  vi.mocked(apiService.getMflMovies).mockResolvedValue({ data: CATALOGUE });
  setPicks([ANORA, HAMNET], 35);
});

describe("MFL my picks", () => {
  it("lists the roster with the server's total", async () => {
    renderPage();

    expect(await screen.findByRole("link", { name: "Anora" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Hamnet" })).toBeInTheDocument();
    // 35 is the server's number, not a client sum.
    expect(
      screen.getByRole("row", { name: /Roster total/ }),
    ).toHaveTextContent("35");
  });

  it("offers only films that are not already picked", async () => {
    renderPage();
    await screen.findByRole("link", { name: "Anora" });

    const select = screen.getByRole("combobox", { name: /select a movie/i });
    const options = within(select)
      .getAllByRole("option")
      .map((o) => o.textContent);

    expect(options).toContain("Sinners");
    expect(options).not.toContain("Anora");
    expect(options).not.toContain("Hamnet");
  });

  it("adds a pick and refreshes the roster", async () => {
    vi.mocked(apiService.addMflPick).mockResolvedValue({ message: "ok" });
    renderPage();
    await screen.findByRole("link", { name: "Anora" });

    setPicks([ANORA, HAMNET, { ...CATALOGUE[2]! }], 35);
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: /select a movie/i }),
      "sinners",
    );

    expect(apiService.addMflPick).toHaveBeenCalledWith("sinners", TOKEN);
    expect(
      await screen.findByRole("link", { name: "Sinners" }),
    ).toBeInTheDocument();
  });

  it("removes a pick and refreshes the roster", async () => {
    vi.mocked(apiService.removeMflPick).mockResolvedValue({ message: "ok" });
    renderPage();
    await screen.findByRole("link", { name: "Anora" });

    setPicks([HAMNET], 10);
    await userEvent.click(
      screen.getByRole("button", { name: /Remove Anora/ }),
    );

    expect(apiService.removeMflPick).toHaveBeenCalledWith("anora", TOKEN);
    await waitFor(() =>
      expect(screen.queryByRole("link", { name: "Anora" })).not.toBeInTheDocument(),
    );
  });

  it("shows the server's message when a pick is rejected", async () => {
    vi.mocked(apiService.addMflPick).mockRejectedValue(
      new ApiError("You have already picked sinners.", 409),
    );
    renderPage();
    await screen.findByRole("link", { name: "Anora" });

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: /select a movie/i }),
      "sinners",
    );

    expect(
      await screen.findByText("You have already picked sinners."),
    ).toBeInTheDocument();
  });

  it("hides a 5xx body behind a generic message", async () => {
    const leak = 'null value in column "lbusername" violates not-null constraint';
    vi.mocked(apiService.addMflPick).mockRejectedValue(new ApiError(leak, 500));
    renderPage();
    await screen.findByRole("link", { name: "Anora" });

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: /select a movie/i }),
      "sinners",
    );

    expect(
      await screen.findByText("Something went wrong. Please try again."),
    ).toBeInTheDocument();
    expect(screen.queryByText(leak)).not.toBeInTheDocument();
  });

  it("tells an empty roster apart from a failed load", async () => {
    setPicks([], 0);
    renderPage();

    expect(
      await screen.findByText("You have not picked any films yet."),
    ).toBeInTheDocument();
  });

  it("asks an unlinked account to see an admin instead of offering the form", async () => {
    vi.mocked(apiService.getCurrentUser).mockResolvedValue({ data: UNLINKED });
    renderPage();

    expect(
      await screen.findByText(/Ask an admin to link one/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(apiService.getMflPicks).not.toHaveBeenCalled();
  });
});
