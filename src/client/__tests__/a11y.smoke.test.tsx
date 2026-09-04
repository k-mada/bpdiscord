import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { axeViolations } from "./helpers/axe";
import { installFakeLocalStorage } from "./helpers/localStorage";
import { AuthProvider } from "../contexts/AuthContext";
import apiService from "../services/api";
import LoginPage from "../components/LoginPage";
import SignupPage from "../components/SignupPage";
import ForgotPassword from "../components/ForgotPassword";
import { DataTable } from "../components/DataTable/DataTable";
import { mflFilmColumns } from "../components/DataTable/columns";
import StarRating from "../components/StarRating";
import CollapsibleSection from "../components/CollapsibleSection";
import MovieList from "../components/MovieList";
import { Modal, ModalHeader, ModalBody } from "../components/Modal";
import RatingDistributionHistogram from "../components/RatingDistributionHistogram";
import TasteCompatibility from "../components/TasteCompatibility";
import { DialogProvider } from "../contexts/DialogContext";
import type { LBFilm } from "../types";

vi.mock("../services/api");
vi.mock("../components/Subheading", () => ({
  Subheading: () => <div data-testid="subheading" />,
}));

// Structural checks only. jsdom has no layout, so axe here cannot see contrast,
// focus order, or anything revealed on hover.
function withProviders(ui: React.ReactNode) {
  return (
    <AuthProvider>
      <MemoryRouter>{ui}</MemoryRouter>
    </AuthProvider>
  );
}

const films: LBFilm[] = [
  {
    film_slug: "anatomy-of-a-fall",
    title: "Anatomy of a Fall",
    poster: "https://example.test/a.jpg",
    banner: "https://example.test/b.jpg",
    tmdb_link: "https://example.test/tmdb",
    url: "https://letterboxd.com/film/anatomy-of-a-fall/",
    average_rating: 4.2,
    rating_count: 38,
    watch_count: 41,
  },
];

describe("accessibility smoke (axe, structural)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installFakeLocalStorage();
    vi.mocked(apiService.getCurrentUser).mockResolvedValue({});
  });

  it.each([
    ["LoginPage", <LoginPage key="l" />],
    ["SignupPage", <SignupPage key="s" />],
    ["ForgotPassword", <ForgotPassword key="f" />],
  ])("%s has no axe violations", async (_name, ui) => {
    const { container } = render(withProviders(ui));
    expect(await axeViolations(container)).toEqual([]);
  });

  it("DataTable has no axe violations", async () => {
    const { container } = render(
      <DataTable
        data={[{ rank: 1, user: "rooney" }]}
        columns={[
          { key: "rank", label: "Rank" },
          { key: "user", label: "User" },
        ]}
      />,
    );
    expect(await axeViolations(container)).toEqual([]);
  });

  it("Modal has no axe violations", async () => {
    render(
      <DialogProvider>
        <Modal isOpen onClose={() => {}}>
          <ModalHeader onClose={() => {}}>Nominees</ModalHeader>
          <ModalBody>
            <p>Body</p>
          </ModalBody>
        </Modal>
      </DialogProvider>,
    );
    expect(await axeViolations(document.body)).toEqual([]);
  });

  it("StarRating has no axe violations", async () => {
    const { container } = render(<StarRating rating={3.5} />);
    expect(await axeViolations(container)).toEqual([]);
  });

  it("CollapsibleSection has no axe violations", async () => {
    const { container } = render(
      <CollapsibleSection title="How is this calculated?">
        <p>Body</p>
      </CollapsibleSection>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });

  it("MovieList has no axe violations", async () => {
    const { container } = render(
      withProviders(<MovieList movies={films} animated={false} showRating />),
    );
    expect(await axeViolations(container)).toEqual([]);
  });

  it("RatingDistributionHistogram has no axe violations", async () => {
    const { container } = render(
      <table>
        <tbody>
          <tr>
            <td>
              <RatingDistributionHistogram
                distribution={[
                  { rating: 2, count: 4 },
                  { rating: 4, count: 9 },
                ]}
              />
            </td>
          </tr>
        </tbody>
      </table>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });

  it("TasteCompatibility has no axe violations", async () => {
    const { container } = render(
      <TasteCompatibility
        user1Data={{ username: "rooney" }}
        user2Data={{ username: "mara" }}
        moviesInCommon={[]}
        compatibility={{ pearson: 0.4, mad: 0.8, sampleSize: 20 }}
      />,
    );
    expect(await axeViolations(container)).toEqual([]);
  });

  it("the MFL films table has no axe violations", async () => {
    const { container } = render(
      withProviders(
        <DataTable
          data={[
            {
              title: "Anora",
              filmSlug: "anora",
              releaseDate: "2026-10-18",
              price: 40,
              totalPoints: 25,
              pointsByCategory: { awards: 25 },
            },
            {
              title: "Hamnet",
              filmSlug: "hamnet",
              releaseDate: null,
              price: null,
              totalPoints: 0,
              pointsByCategory: {},
            },
          ]}
          columns={mflFilmColumns(["awards", "box_office"])}
          enableSort
          initialSort={{ key: "totalPoints", direction: "desc" }}
        />,
      ),
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
