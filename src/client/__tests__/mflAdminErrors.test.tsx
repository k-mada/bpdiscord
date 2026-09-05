import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import MFLAdmin from "../components/MovieFantasyLeague/Admin";
import apiService from "../services/api";
import { AuthProvider } from "../contexts/AuthContext";
import { DialogProvider } from "../contexts/DialogContext";
import { ApiError } from "../lib/apiError";
import type { CurrentUser, MFLMovieScore, MFLScoringMetric } from "../types";
import { installFakeLocalStorage } from "./helpers/localStorage";
import { futureJwt } from "./helpers/jwt";

const TOKEN = futureJwt();

vi.mock("../services/api");
vi.mock("../components/Spinner", () => ({
  default: () => <div data-testid="spinner" />,
}));

const ADMIN_USER: CurrentUser = {
  id: "admin-id",
  email: "admin@example.com",
  role: "admin",
  lbusername: "admin-lb",
  displayName: "Admin",
};

// Not in Admin.tsx's customizableMetricIds ([1, 10, 338]) — those rows render
// Edit instead of Delete.
const METRIC: MFLScoringMetric = {
  metricId: 2,
  metric: "oscar",
  metricName: "Best Picture",
  category: "awards",
  scoringCondition: "win",
  pointValue: 25,
};

const SCORE: MFLMovieScore = {
  scoringId: 501,
  filmSlug: "anora",
  metricId: 2,
  pointsAwarded: 25,
  category: "awards",
  metric: "oscar",
  metricName: "Best Picture",
  scoringCondition: "win",
};

function renderPage() {
  return render(
    <AuthProvider>
      <DialogProvider>
        <MemoryRouter>
          <MFLAdmin />
        </MemoryRouter>
      </DialogProvider>
    </AuthProvider>,
  );
}

/** Picks the seeded film so the score table and its Delete buttons render. */
async function selectFilm() {
  const select = await screen.findByRole("combobox", { name: /select a movie/i });
  await userEvent.selectOptions(select, "anora");
  await screen.findByRole("button", { name: "Delete" });
}

/** The dialog's own confirm button; the row button shares its label. */
async function confirmDelete() {
  const dialog = await screen.findByRole("dialog");
  await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
}

beforeEach(() => {
  installFakeLocalStorage();
  localStorage.setItem("token", TOKEN);
  vi.clearAllMocks();
  vi.mocked(apiService.getCurrentUser).mockResolvedValue({ data: ADMIN_USER });
  vi.mocked(apiService.getMflScoringMetrics).mockResolvedValue({
    data: [METRIC],
  });
  vi.mocked(apiService.getMflMovies).mockResolvedValue({
    data: [
      {
        title: "Anora",
        filmSlug: "anora",
        releaseDate: "2026-10-18",
        price: 40,
        totalPoints: 25,
        pointsByCategory: { awards: 25 },
      },
    ],
  });
  vi.mocked(apiService.getMflMovieScore).mockResolvedValue({ data: [SCORE] });
});

describe("MFL admin surfaces write failures", () => {
  it("shows the server's message for a 409 duplicate award", async () => {
    vi.mocked(apiService.deleteMflMovieScore).mockRejectedValue(
      new ApiError("That film already has this scoring metric", 409),
    );

    renderPage();
    await selectFilm();
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await confirmDelete();

    expect(
      await screen.findByText("That film already has this scoring metric"),
    ).toBeInTheDocument();
  });

  it("shows the server's message for a 400", async () => {
    vi.mocked(apiService.deleteMflMovieScore).mockRejectedValue(
      new ApiError("scoringId must be a positive integer", 400),
    );

    renderPage();
    await selectFilm();
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await confirmDelete();

    expect(
      await screen.findByText("scoringId must be a positive integer"),
    ).toBeInTheDocument();
  });

  it("hides the Postgres text behind a generic message on a 500", async () => {
    const leak =
      'duplicate key value violates unique constraint "mfl_scoring_tally_film_metric_key"';
    vi.mocked(apiService.deleteMflMovieScore).mockRejectedValue(
      new ApiError(leak, 500),
    );

    renderPage();
    await selectFilm();
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await confirmDelete();

    expect(
      await screen.findByText("Something went wrong. Please try again."),
    ).toBeInTheDocument();
    expect(screen.queryByText(leak)).not.toBeInTheDocument();
  });

  it("keeps the confirm dialog open when the delete fails", async () => {
    vi.mocked(apiService.deleteMflMovieScore).mockRejectedValue(
      new ApiError("nope", 409),
    );

    renderPage();
    await selectFilm();
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await confirmDelete();

    await screen.findByText("nope");
    // The dialog dismissing itself here would read as success.
    expect(screen.getByText("This action cannot be undone.")).toBeInTheDocument();
  });

  it("closes the confirm dialog when the delete succeeds", async () => {
    vi.mocked(apiService.deleteMflMovieScore).mockResolvedValue({
      message: "deleted",
    });

    renderPage();
    await selectFilm();
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await confirmDelete();

    await waitFor(() =>
      expect(
        screen.queryByText("This action cannot be undone."),
      ).not.toBeInTheDocument(),
    );
  });

  it("clears a previous failure when the dialog is cancelled", async () => {
    vi.mocked(apiService.deleteMflMovieScore).mockRejectedValue(
      new ApiError("stale failure", 409),
    );

    renderPage();
    await selectFilm();
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await confirmDelete();
    await screen.findByText("stale failure");

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.queryByText("stale failure")).not.toBeInTheDocument();
  });

  it("releases the spinner when loading a film's scores fails", async () => {
    vi.mocked(apiService.getMflMovieScore).mockRejectedValue(
      new ApiError("boom", 500),
    );

    renderPage();
    const select = await screen.findByRole("combobox", {
      name: /select a movie/i,
    });
    await userEvent.selectOptions(select, "anora");

    expect(
      await screen.findByText("Something went wrong. Please try again."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("spinner")).not.toBeInTheDocument();
  });
});
