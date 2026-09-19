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

    expect(screen.getAllByRole("button", { name: "Delete" })).toHaveLength(3);
    expect(
      screen.queryByRole("button", { name: "Edit" }),
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
});
