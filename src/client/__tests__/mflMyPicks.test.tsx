import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import MyPicks from "../components/MovieFantasyLeague/MyPicks";
import apiService from "../services/api";
import { AuthProvider } from "../contexts/AuthContext";
import { DialogProvider } from "../contexts/DialogContext";
import { ApiError } from "../lib/apiError";
import { axeViolations } from "./helpers/axe";
import type { CurrentUser, MFLCatalogueFilm, MFLPick } from "../types";
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

/** Ten films at $10 so eight fit the budget exactly and the dear one breaks it. */
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
      <DialogProvider>
        <MemoryRouter>
          <MyPicks />
        </MemoryRouter>
      </DialogProvider>
    </AuthProvider>,
  );
}

/** The slot's own button; the clear button beside it has no comma. */
const slotButton = (n: number) =>
  screen.getByRole("button", { name: new RegExp(`, slot ${n}$`) });

const slotButtons = () => screen.getAllByRole("button", { name: /, slot \d$/ });

async function openSlot(n: number) {
  await userEvent.click(slotButton(n));
  return screen.findByRole("dialog");
}

async function pick(n: number, title: string) {
  const dialog = await openSlot(n);
  await userEvent.click(
    within(dialog).getByRole("button", { name: `Select ${title}` }),
  );
}

/** Fills slots 1..count with Film 0..count-1. */
async function fill(count: number) {
  for (let i = 0; i < count; i++) await pick(i + 1, `Film ${i}`);
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

    await waitFor(() => expect(slotButtons()).toHaveLength(8));
    expect(screen.getAllByText("Select movie")).toHaveLength(8);
    expect(screen.getByText("0 of 8 movies selected")).toBeInTheDocument();
  });

  it("opens the picker for the slot that was clicked", async () => {
    renderPage();
    await waitFor(() => expect(slotButtons()).toHaveLength(8));

    const dialog = await openSlot(3);
    expect(
      within(dialog).getByText("Select a movie for slot 3"),
    ).toBeInTheDocument();
  });

  it("lists title, release date and price in the picker", async () => {
    renderPage();
    await waitFor(() => expect(slotButtons()).toHaveLength(8));
    const dialog = await openSlot(1);

    const row = within(dialog).getByText("Dear One").closest("tr")!;
    expect(row).toHaveTextContent("$95");
    // A null release date is not a blank cell.
    expect(row).toHaveTextContent("TBA");
    expect(
      within(dialog).getByRole("columnheader", { name: /Released/ }),
    ).toBeInTheDocument();
  });

  it("orders the picker by price, dearest first", async () => {
    renderPage();
    await waitFor(() => expect(slotButtons()).toHaveLength(8));
    const dialog = await openSlot(1);

    const firstRow = within(dialog).getAllByRole("row")[1]!;
    expect(firstRow).toHaveTextContent("Dear One");
  });

  it("populates the slot and the running total", async () => {
    renderPage();
    await waitFor(() => expect(slotButtons()).toHaveLength(8));

    await pick(1, "Film 0");

    expect(screen.getByText("1 of 8 movies selected")).toBeInTheDocument();
    expect(slotButton(1)).toHaveTextContent("Film 0");
    // The slot and the total both read $10; assert the total specifically.
    expect(
      screen.getByText("Your total spend").parentElement,
    ).toHaveTextContent("$10");
  });

  it("marks a film held by another slot as already picked", async () => {
    renderPage();
    await waitFor(() => expect(slotButtons()).toHaveLength(8));
    await pick(1, "Film 0");

    const dialog = await openSlot(2);
    const row = within(dialog).getByText("Film 0").closest("tr")!;
    expect(row).toHaveTextContent("Already picked");
    expect(
      within(dialog).queryByRole("button", { name: "Select Film 0" }),
    ).not.toBeInTheDocument();
  });

  it("still offers the film the edited slot already holds", async () => {
    renderPage();
    await waitFor(() => expect(slotButtons()).toHaveLength(8));
    await pick(1, "Film 0");

    const dialog = await openSlot(1);
    expect(
      within(dialog).getByRole("button", { name: "Select Film 0" }),
    ).toBeInTheDocument();
  });

  it("says it is over budget in text, not colour alone", async () => {
    renderPage();
    await waitFor(() => expect(slotButtons()).toHaveLength(8));

    await fill(7);
    await pick(8, "Dear One");

    const total = screen.getByText(/\$165/);
    expect(total).toHaveTextContent("(over budget)");
    expect(total.className).toContain("text-letterboxd-error");
    expect(screen.getByText(/\$65 over the \$100 budget/)).toBeInTheDocument();
  });

  it("disables submit until eight are chosen", async () => {
    renderPage();
    await waitFor(() => expect(slotButtons()).toHaveLength(8));

    const submit = screen.getByRole("button", { name: /Submit picks/ });
    expect(submit).toBeDisabled();

    await fill(7);
    expect(submit).toBeDisabled();

    await pick(8, "Film 7");
    expect(submit).toBeEnabled();
  });

  it("disables submit while over budget even with eight chosen", async () => {
    renderPage();
    await waitFor(() => expect(slotButtons()).toHaveLength(8));

    await fill(7);
    await pick(8, "Dear One");

    expect(screen.getByRole("button", { name: /Submit picks/ })).toBeDisabled();
  });

  it("clears a slot with its X and frees the film again", async () => {
    renderPage();
    await waitFor(() => expect(slotButtons()).toHaveLength(8));
    await fill(2);

    await userEvent.click(screen.getByRole("button", { name: "Remove Film 0" }));
    expect(screen.getByText("1 of 8 movies selected")).toBeInTheDocument();

    const dialog = await openSlot(3);
    expect(
      within(dialog).getByRole("button", { name: "Select Film 0" }),
    ).toBeInTheDocument();
  });

  it("submits all eight slugs at once", async () => {
    vi.mocked(apiService.replaceMflPicks).mockResolvedValue({ message: "ok" });
    renderPage();
    await waitFor(() => expect(slotButtons()).toHaveLength(8));

    await fill(8);
    await userEvent.click(screen.getByRole("button", { name: /Submit picks/ }));

    expect(apiService.replaceMflPicks).toHaveBeenCalledWith(
      ["film-0", "film-1", "film-2", "film-3", "film-4", "film-5", "film-6", "film-7"],
      TOKEN,
    );
    expect(await screen.findByText("Picks saved.")).toBeInTheDocument();
  });

  it("reloads a saved roster, edits it, and resubmits the change", async () => {
    setSaved(
      Array.from({ length: 8 }, (_, i) => ({
        filmSlug: `film-${i}`,
        title: `Film ${i}`,
        releaseDate: null,
        price: 10,
      })),
    );
    vi.mocked(apiService.replaceMflPicks).mockResolvedValue({ message: "ok" });
    renderPage();

    expect(await screen.findByText("8 of 8 movies selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Submit picks/ })).toBeEnabled();

    await pick(3, "Film 8");
    await userEvent.click(screen.getByRole("button", { name: /Submit picks/ }));

    expect(apiService.replaceMflPicks).toHaveBeenCalledWith(
      ["film-0", "film-1", "film-8", "film-3", "film-4", "film-5", "film-6", "film-7"],
      TOKEN,
    );
  });

  it("shows the server's message when a save is rejected", async () => {
    vi.mocked(apiService.replaceMflPicks).mockRejectedValue(
      new ApiError("A film cannot be picked twice.", 400),
    );
    renderPage();
    await waitFor(() => expect(slotButtons()).toHaveLength(8));

    await fill(8);
    await userEvent.click(screen.getByRole("button", { name: /Submit picks/ }));

    expect(
      await screen.findByText("A film cannot be picked twice."),
    ).toBeInTheDocument();
  });

  // Every price comes from the catalogue; without it the roster renders each
  // film at $0 and a total that is simply wrong.
  it("blocks editing when the catalogue fails rather than pricing everything at zero", async () => {
    vi.mocked(apiService.getMflMovies).mockRejectedValue(
      new ApiError("boom", 500),
    );
    setSaved([
      { filmSlug: "film-0", title: "Film 0", releaseDate: null, price: 10 },
    ]);
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Prices are unavailable/,
    );
    expect(screen.queryByText("Your total spend")).not.toBeInTheDocument();
    expect(slotButtons.bind(null)).toThrow();
  });

  it("has no axe violations with slots both filled and empty", async () => {
    const { container } = renderPage();
    await waitFor(() => expect(slotButtons()).toHaveLength(8));
    await fill(2);

    expect(await axeViolations(container)).toEqual([]);
  });

  it("asks an unlinked account to see an admin instead of offering slots", async () => {
    vi.mocked(apiService.getCurrentUser).mockResolvedValue({ data: UNLINKED });
    renderPage();

    expect(
      await screen.findByText(/Ask an admin to link one/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /, slot 1$/ })).not.toBeInTheDocument();
    expect(apiService.getMflPicks).not.toHaveBeenCalled();
  });
});
