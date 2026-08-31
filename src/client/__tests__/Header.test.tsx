import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Header from "../components/Header";
import { AuthProvider } from "../contexts/AuthContext";
import { installFakeLocalStorage } from "./helpers/localStorage";
import apiService from "../services/api";

vi.mock("../services/api");
vi.mock("../components/Subheading", () => ({
  Subheading: () => <div data-testid="subheading" />,
}));

const renderHeader = (initial = "/") =>
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initial]}>
        <Header />
      </MemoryRouter>
    </AuthProvider>,
  );

describe("Header", () => {
  beforeEach(() => {
    installFakeLocalStorage();
    vi.mocked(apiService.getCurrentUser).mockResolvedValue({});
  });

  // The desktop list and the mobile menu are separate subtrees. Two landmarks
  // sharing a name is a duplicate, so one nav has to cover both.
  it("exposes exactly one named navigation landmark", () => {
    renderHeader();

    const navs = screen.getAllByRole("navigation");
    expect(navs).toHaveLength(1);
    expect(navs[0]).toHaveAccessibleName("Main");
  });

  it("marks the active route and only the active route", () => {
    renderHeader("/compare");

    const nav = screen.getByRole("navigation");
    const current = within(nav)
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");

    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAccessibleName("Compare");
  });

  it("marks nothing when the route is not in the menu", () => {
    renderHeader("/film/anatomy-of-a-fall");

    expect(screen.queryByRole("link", { current: "page" })).toBeNull();
  });

  it("reports the hamburger state and points at the menu it controls", async () => {
    renderHeader();

    const toggle = screen.getByRole("button", { name: "Toggle menu" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const menuId = toggle.getAttribute("aria-controls")!;
    expect(document.getElementById(menuId)).not.toBeNull();
  });
});
