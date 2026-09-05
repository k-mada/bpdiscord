import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import MyPicks from "../components/MovieFantasyLeague/MyPicks";
import apiService from "../services/api";
import { AuthProvider } from "../contexts/AuthContext";
import { ApiError } from "../lib/apiError";
import type { CurrentUser, MFLCatalogueFilm, MFLPick } from "../types";
import { axeViolations } from "./helpers/axe";
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

/** Ten films at $10 so eight fit the budget exactly and nine do not. */
const CATALOGUE: MFLCatalogueFilm[] = Array.from({ length: 10 }, (_, i) => ({
  filmSlug: `film-${i}`,
  title: `Film ${i}`,
  releaseDate: "2026-10-18",
  price: 10,
  totalPoints: 0,
  pointsByCategory: {},
}));

const DEAR: MFLCatalogueFilm = {
  filmSlug: "dear",
  title: "Dear One",
  releaseDate: null,
  price: 95,
  totalPoints: 0,
  pointsByCategory: {},
};

function renderPage() {
  return render(
    <AuthProvider>
      <MemoryRouter>
        <MyPicks />
      </MemoryRouter>
    </AuthProvider>,
  );
}

const slots = () => screen.getAllByRole("combobox");

async function fill(count: number) {
  for (let i = 0; i < count; i++) {
    await userEvent.selectOptions(slots()[i]!, `film-${i}`);
  }
}

function setSaved(picks: MFLPick[]) {
  vi.mocked(apiService.getMflPicks).mockResolvedValue({ data: picks });
}

beforeEach(() => {
  installFakeLocalStorage();
  localStorage.setItem("token", TOKEN);
  vi.clearAllMocks();
  vi.mocked(apiService.getCurrentUser).mockResolvedValue({ data: LINKED });
  vi.mocked(apiService.getMflScoringMetrics).mockResolvedValue({ data: [] });
  vi.mocked(apiService.getMflMovies).mockResolvedValue({
    data: [...CATALOGUE, DEAR],
  });
  setSaved([]);
});

describe("MFL my picks", () => {
  it("renders eight empty slots", async () => {
    renderPage();

    await waitFor(() => expect(slots()).toHaveLength(8));
    expect(screen.getAllByText("Select movie")).toHaveLength(8);
    expect(screen.getByText("0 of 8 movies selected")).toBeInTheDocument();
  });

  it("labels each slot distinctly for a screen reader", async () => {
    renderPage();
    await waitFor(() => expect(slots()).toHaveLength(8));

    expect(screen.getByLabelText("Movie 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Movie 8")).toBeInTheDocument();
  });

  it("shows the price alongside the title in the dropdown", async () => {
    renderPage();
    await waitFor(() => expect(slots()).toHaveLength(8));

    expect(
      within(slots()[0]!).getByRole("option", { name: "Dear One ($95)" }),
    ).toBeInTheDocument();
  });

  it("adds each selection to the running total", async () => {
    renderPage();
    await waitFor(() => expect(slots()).toHaveLength(8));

    await fill(3);

    expect(screen.getByText("3 of 8 movies selected")).toBeInTheDocument();
    expect(screen.getByText("$30")).toBeInTheDocument();
  });

  it("will not offer a film already chosen in another slot", async () => {
    renderPage();
    await waitFor(() => expect(slots()).toHaveLength(8));

    await userEvent.selectOptions(slots()[0]!, "film-0");

    expect(
      within(slots()[1]!).queryByRole("option", { name: "Film 0 ($10)" }),
    ).not.toBeInTheDocument();
    // Still offered in the slot that holds it, or the value could not render.
    expect(
      within(slots()[0]!).getByRole("option", { name: "Film 0 ($10)" }),
    ).toBeInTheDocument();
  });

  it("says it is over budget in text, not colour alone", async () => {
    renderPage();
    await waitFor(() => expect(slots()).toHaveLength(8));

    await fill(7);
    await userEvent.selectOptions(slots()[7]!, "dear");

    const total = screen.getByText(/\$165/);
    expect(total).toHaveTextContent("(over budget)");
    expect(total.className).toContain("text-letterboxd-error");
    expect(
      screen.getByText(/\$65 over the \$100 budget/),
    ).toBeInTheDocument();
  });

  it("disables submit until eight are chosen", async () => {
    renderPage();
    await waitFor(() => expect(slots()).toHaveLength(8));

    const submit = screen.getByRole("button", { name: "Submit picks" });
    expect(submit).toBeDisabled();

    await fill(7);
    expect(submit).toBeDisabled();

    await fill(8);
    expect(submit).toBeEnabled();
  });

  it("disables submit while over budget even with eight chosen", async () => {
    renderPage();
    await waitFor(() => expect(slots()).toHaveLength(8));

    await fill(7);
    await userEvent.selectOptions(slots()[7]!, "dear");

    expect(screen.getByRole("button", { name: "Submit picks" })).toBeDisabled();
  });

  it("clears a slot with its X and frees the film again", async () => {
    renderPage();
    await waitFor(() => expect(slots()).toHaveLength(8));

    await fill(2);
    await userEvent.click(screen.getByRole("button", { name: "Remove Film 0" }));

    expect(screen.getByText("1 of 8 movies selected")).toBeInTheDocument();
    expect(
      within(slots()[1]!).getByRole("option", { name: "Film 0 ($10)" }),
    ).toBeInTheDocument();
  });

  it("submits all eight slugs at once", async () => {
    vi.mocked(apiService.replaceMflPicks).mockResolvedValue({ message: "ok" });
    renderPage();
    await waitFor(() => expect(slots()).toHaveLength(8));

    await fill(8);
    await userEvent.click(screen.getByRole("button", { name: "Submit picks" }));

    expect(apiService.replaceMflPicks).toHaveBeenCalledWith(
      ["film-0", "film-1", "film-2", "film-3", "film-4", "film-5", "film-6", "film-7"],
      TOKEN,
    );
    expect(await screen.findByText("Picks saved.")).toBeInTheDocument();
  });

  it("loads a saved roster into the slots", async () => {
    setSaved([
      { filmSlug: "film-3", title: "Film 3", releaseDate: null, price: 10 },
      { filmSlug: "film-5", title: "Film 5", releaseDate: null, price: 10 },
    ]);
    renderPage();

    expect(
      await screen.findByText("2 of 8 movies selected"),
    ).toBeInTheDocument();
    expect(slots()[0]).toHaveValue("film-3");
  });

  it("shows the server's message when a save is rejected", async () => {
    vi.mocked(apiService.replaceMflPicks).mockRejectedValue(
      new ApiError("A film cannot be picked twice.", 400),
    );
    renderPage();
    await waitFor(() => expect(slots()).toHaveLength(8));

    await fill(8);
    await userEvent.click(screen.getByRole("button", { name: "Submit picks" }));

    expect(
      await screen.findByText("A film cannot be picked twice."),
    ).toBeInTheDocument();
  });

  it("has no axe violations with slots both filled and empty", async () => {
    const { container } = renderPage();
    await waitFor(() => expect(slots()).toHaveLength(8));
    await fill(2);

    expect(await axeViolations(container)).toEqual([]);
  });

  it("asks an unlinked account to see an admin instead of offering slots", async () => {
    vi.mocked(apiService.getCurrentUser).mockResolvedValue({ data: UNLINKED });
    renderPage();

    expect(
      await screen.findByText(/Ask an admin to link one/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(apiService.getMflPicks).not.toHaveBeenCalled();
  });
});
