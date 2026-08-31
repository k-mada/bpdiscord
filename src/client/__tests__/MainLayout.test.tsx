import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import MainLayout from "../components/MainLayout";
import { AuthProvider } from "../contexts/AuthContext";
import { installFakeLocalStorage } from "./helpers/localStorage";
import apiService from "../services/api";
import { SITE_NAME } from "../components/routeTitles";

vi.mock("../services/api");
vi.mock("../components/Subheading", () => ({
  Subheading: () => <div data-testid="subheading" />,
}));

const GoToCompare = () => {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate("/compare")}>
      go
    </button>
  );
};

const renderLayout = (initial = "/") =>
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<GoToCompare />} />
            <Route path="compare" element={<p>compare page</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );

const liveRegion = () =>
  document.querySelector('[aria-live="polite"].sr-only')!;

describe("MainLayout", () => {
  beforeEach(() => {
    installFakeLocalStorage();
    vi.mocked(apiService.getCurrentUser).mockResolvedValue({});
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });

  it("titles the first route without announcing it", () => {
    renderLayout("/compare");

    expect(document.title).toBe(`Compare users — ${SITE_NAME}`);
    // The screen reader already reads the page on load; announcing on top of
    // that is noise, and this is what the pathname ref exists to prevent.
    expect(liveRegion()).toHaveTextContent("");
  });

  it("announces and retitles on a route change", async () => {
    renderLayout("/");
    expect(document.title).toBe(`Home — ${SITE_NAME}`);

    await userEvent.click(screen.getByRole("button", { name: "go" }));

    expect(document.title).toBe(`Compare users — ${SITE_NAME}`);
    expect(liveRegion()).toHaveTextContent("Compare users");
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it("keeps the live region outside main, where a route swap cannot unmount it", () => {
    renderLayout("/");

    expect(screen.getByRole("main").contains(liveRegion())).toBe(false);
  });

  it("offers a skip link that targets a focusable main", () => {
    renderLayout("/");

    const skip = screen.getByRole("link", { name: "Skip to main content" });
    const main = screen.getByRole("main");

    expect(skip).toHaveAttribute("href", `#${main.id}`);
    expect(main).toHaveAttribute("tabindex", "-1");
  });
});
