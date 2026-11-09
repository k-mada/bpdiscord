import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import MFLAdmin from "../components/MovieFantasyLeague/Admin";
import apiService from "../services/api";
import { AuthProvider } from "../contexts/AuthContext";
import { DialogProvider } from "../contexts/DialogContext";
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

// metricId 1 is in Admin.tsx's customizableMetricIds — its row used to render
// Edit instead of Delete; every row now gets Delete.
const metric = (
  metricId: number,
  metricName: string,
): MFLScoringMetric => ({
  metricId,
  metric: metricName.toLowerCase(),
  metricName,
  category: "awards",
  scoringCondition: "win",
  pointValue: 10,
});

const score = (
  scoringId: number,
  metricId: number,
  metricName: string,
): MFLMovieScore => ({
  scoringId,
  filmSlug: "anora",
  metricId,
  pointsAwarded: 10,
  category: "awards",
  metric: metricName.toLowerCase(),
  metricName,
  scoringCondition: "win",
});

const rankMetric = (): MFLScoringMetric => ({
  metricId: 50,
  metric: "rank",
  metricName: "rank",
  category: "weeks-at-1",
  scoringCondition: "at #1",
  pointValue: 20,
});

const rankScore = (
  scoringId: number,
  pointsAwarded: number,
): MFLMovieScore => ({
  scoringId,
  filmSlug: "anora",
  metricId: 50,
  pointsAwarded,
  category: "weeks-at-1",
  metric: "rank",
  metricName: "rank",
  scoringCondition: "at #1",
});

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

async function selectFilm() {
  const select = await screen.findByRole("combobox", {
    name: /select a movie/i,
  });
  await userEvent.selectOptions(select, "anora");
  await screen.findByRole("table");
}

beforeEach(() => {
  installFakeLocalStorage();
  localStorage.setItem("token", TOKEN);
  vi.clearAllMocks();
  vi.mocked(apiService.getCurrentUser).mockResolvedValue({ data: ADMIN_USER });
  vi.mocked(apiService.getMflScoringMetrics).mockResolvedValue({
    data: [metric(2, "Best Picture"), metric(1, "Box office"), metric(3, "Audience award")],
  });
  vi.mocked(apiService.getMflMovies).mockResolvedValue({
    data: [
      {
        title: "Anora",
        filmSlug: "anora",
        releaseDate: "2026-10-18",
        price: 40,
        totalPoints: 30,
        pointsByCategory: { awards: 30 },
      },
    ],
  });
});

describe("MFL admin score management", () => {
  it("offers Delete on every score row, including customizable metrics", async () => {
    vi.mocked(apiService.getMflMovieScore).mockResolvedValue({
      data: [
        score(101, 2, "Best Picture"),
        score(102, 1, "Box office"),
        score(103, 3, "Audience award"),
      ],
    });

    renderPage();
    await selectFilm();

    expect(screen.getAllByRole("button", { name: /^Delete / })).toHaveLength(3);
    expect(
      screen.queryByRole("button", { name: /^Edit / }),
    ).not.toBeInTheDocument();
  });

  it("renders scores in the dropdown's metric order regardless of API order", async () => {
    vi.mocked(apiService.getMflMovieScore).mockResolvedValue({
      data: [
        score(102, 1, "Box office"),
        score(103, 3, "Audience award"),
        score(101, 2, "Best Picture"),
      ],
    });

    renderPage();
    await selectFilm();

    const text = screen.getByRole("table").textContent ?? "";
    expect(text.indexOf("Audience award")).toBeLessThan(
      text.indexOf("Best Picture"),
    );
    expect(text.indexOf("Best Picture")).toBeLessThan(
      text.indexOf("Box office"),
    );
  });

  it("edits the cumulative gross metric in place and saves with its scoringId", async () => {
    const grossEvery: MFLMovieScore = {
      scoringId: 201,
      filmSlug: "anora",
      metricId: 1,
      pointsAwarded: 64,
      category: "domestic - every $1,000,000",
      metric: "gross",
      metricName: "gross",
      scoringCondition: "every",
    };
    const grossCleared: MFLMovieScore = {
      ...grossEvery,
      scoringId: 202,
      pointsAwarded: 10,
      category: "domestic - cleared $25,000,000",
    };
    vi.mocked(apiService.getMflMovieScore).mockResolvedValue({
      data: [grossEvery, grossCleared],
    });
    vi.mocked(apiService.upsertMflMovieScore).mockResolvedValue({ data: {} });

    renderPage();
    await selectFilm();

    // Only the cumulative "every" row is editable; the "cleared" threshold is not.
    expect(screen.getAllByRole("button", { name: /^Edit / })).toHaveLength(1);

    await userEvent.click(
      screen.getByRole("button", { name: /edit gross domestic - every/i }),
    );
    const input = screen.getByLabelText(
      /points for gross domestic - every/i,
    ) as HTMLInputElement;
    expect(input.value).toBe("64");

    await userEvent.type(input, "{selectall}70");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(apiService.upsertMflMovieScore).toHaveBeenCalledWith(
      { filmSlug: "anora", pointsAwarded: 70, metricId: 1, scoringId: 201 },
      TOKEN,
    );
  });

  it("does not latch NaN in points awarded on non-numeric input, and stays editable", async () => {
    vi.mocked(apiService.getMflMovieScore).mockResolvedValue({
      data: [score(101, 2, "Best Picture")],
    });

    renderPage();
    await selectFilm();

    // metricId 1 is customizable, so selecting it enables the points field.
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: /scoring metric/i }),
      "1",
    );
    const points = screen.getByLabelText(
      /points awarded/i,
    ) as HTMLInputElement;
    expect(points).not.toBeDisabled();

    await userEvent.type(points, "{selectall}a");
    expect(points.value).not.toBe("NaN");

    await userEvent.type(points, "{selectall}25");
    expect(points.value).toBe("25");
  });

  it("adds a weeks-at-#1 score as weeks times point value via the dropdown", async () => {
    vi.mocked(apiService.getMflScoringMetrics).mockResolvedValue({
      data: [metric(2, "Best Picture"), rankMetric()],
    });
    vi.mocked(apiService.getMflMovieScore).mockResolvedValue({ data: [] });
    vi.mocked(apiService.upsertMflMovieScore).mockResolvedValue({ data: {} });

    renderPage();
    const movieSelect = await screen.findByRole("combobox", {
      name: /select a movie/i,
    });
    await userEvent.selectOptions(movieSelect, "anora");

    const metricSelect = await screen.findByRole("combobox", {
      name: /scoring metric/i,
    });
    await userEvent.selectOptions(metricSelect, "50");

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: /number of weeks/i }),
      "2",
    );
    await userEvent.click(screen.getByRole("button", { name: /add score/i }));

    expect(apiService.upsertMflMovieScore).toHaveBeenCalledWith(
      { filmSlug: "anora", pointsAwarded: 40, metricId: 50 },
      TOKEN,
    );
  });

  it("disables Add score until a week is chosen for weeks-at-#1", async () => {
    vi.mocked(apiService.getMflScoringMetrics).mockResolvedValue({
      data: [rankMetric()],
    });
    vi.mocked(apiService.getMflMovieScore).mockResolvedValue({ data: [] });

    renderPage();
    const movieSelect = await screen.findByRole("combobox", {
      name: /select a movie/i,
    });
    await userEvent.selectOptions(movieSelect, "anora");
    const metricSelect = await screen.findByRole("combobox", {
      name: /scoring metric/i,
    });
    await userEvent.selectOptions(metricSelect, "50");

    const addButton = screen.getByRole("button", { name: /add score/i });
    expect(addButton).toBeDisabled();

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: /number of weeks/i }),
      "3",
    );
    expect(addButton).toBeEnabled();
  });

  it("edits a weeks-at-#1 score in weeks and saves weeks times point value", async () => {
    vi.mocked(apiService.getMflScoringMetrics).mockResolvedValue({
      data: [rankMetric()],
    });
    vi.mocked(apiService.getMflMovieScore).mockResolvedValue({
      data: [rankScore(301, 40)],
    });
    vi.mocked(apiService.upsertMflMovieScore).mockResolvedValue({ data: {} });

    renderPage();
    await selectFilm();

    await userEvent.click(
      screen.getByRole("button", { name: /edit rank weeks-at-1/i }),
    );
    const weeks = screen.getByRole("combobox", {
      name: /weeks for rank weeks-at-1/i,
    }) as HTMLSelectElement;
    expect(weeks.value).toBe("2");

    await userEvent.selectOptions(weeks, "3");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await screen.findByRole("button", { name: /edit rank weeks-at-1/i });
    expect(apiService.upsertMflMovieScore).toHaveBeenCalledWith(
      { filmSlug: "anora", pointsAwarded: 60, metricId: 50, scoringId: 301 },
      TOKEN,
    );
  });
});
