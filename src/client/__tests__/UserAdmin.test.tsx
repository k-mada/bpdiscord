import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import UserAdmin from "../components/admin/UserAdmin";
import apiService from "../services/api";
import { AuthProvider } from "../contexts/AuthContext";
import type { AccountView, CurrentUser } from "../types";
import { installFakeLocalStorage } from "./helpers/localStorage";
import { futureJwt } from "./helpers/jwt";

// AuthProvider drops a token it judges expired/malformed; use a live JWT.
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

const NON_ADMIN_USER: CurrentUser = {
  id: "user-id",
  email: "user@example.com",
  role: null,
  lbusername: null,
  displayName: "User",
};

const accounts: AccountView[] = [
  {
    id: "admin-id",
    email: "admin@example.com",
    name: "Admin",
    lbusername: "admin-lb",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "bob-id",
    email: "bob@example.com",
    name: "Bob",
    lbusername: null,
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  },
  {
    id: "carol-id",
    email: "carol@example.com",
    name: "Carol",
    lbusername: "carol-lb",
    createdAt: "2026-01-03T00:00:00.000Z",
    updatedAt: "2026-01-03T00:00:00.000Z",
  },
];

const allLetterboxdUsers = [
  { username: "admin-lb" },
  { username: "carol-lb" },
  { username: "unclaimed-1" },
  { username: "unclaimed-2" },
];

function renderPage() {
  return render(
    <AuthProvider>
      <MemoryRouter>
        <UserAdmin />
      </MemoryRouter>
    </AuthProvider>,
  );
}

beforeEach(() => {
  installFakeLocalStorage();
  localStorage.setItem("token", TOKEN);
  vi.clearAllMocks();
  // Admin identity resolved from /me by default; individual tests override.
  vi.mocked(apiService.getCurrentUser).mockResolvedValue({
    data: ADMIN_USER,
  });
});

describe("UserAdmin — admin gate", () => {
  it("renders 403 for non-admin users", async () => {
    vi.mocked(apiService.getCurrentUser).mockResolvedValue({
      data: NON_ADMIN_USER,
    });
    vi.mocked(apiService.getAccounts).mockResolvedValue({ data: [] });

    renderPage();

    await waitFor(() =>
      expect(screen.getByText("Access denied")).toBeInTheDocument(),
    );
    expect(screen.queryByText("User management")).not.toBeInTheDocument();
  });

  it("renders 403 when /me resolves no user", async () => {
    vi.mocked(apiService.getCurrentUser).mockResolvedValue({});
    vi.mocked(apiService.getAccounts).mockResolvedValue({ data: [] });

    renderPage();

    await waitFor(() =>
      expect(screen.getByText("Access denied")).toBeInTheDocument(),
    );
  });
});

describe("UserAdmin — list states", () => {
  it("shows the spinner while accounts are loading", () => {
    vi.mocked(apiService.getAccounts).mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByTestId("spinner")).toBeInTheDocument();
  });

  it("renders an error message when the fetch fails", async () => {
    vi.mocked(apiService.getAccounts).mockRejectedValue(
      new Error("Network down"),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Network down");
    });
  });

  it("renders an empty state when there are no accounts", async () => {
    vi.mocked(apiService.getAccounts).mockResolvedValue({ data: [] });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("No accounts found.")).toBeInTheDocument();
    });
  });

  it("renders the account table with linked + unlinked rows", async () => {
    vi.mocked(apiService.getAccounts).mockResolvedValue({ data: accounts });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("admin@example.com")).toBeInTheDocument();
    });

    // Linked user has an external link to letterboxd.com
    const adminLink = screen.getByRole("link", { name: "admin-lb" });
    expect(adminLink).toHaveAttribute(
      "href",
      "https://letterboxd.com/admin-lb",
    );
    expect(adminLink).toHaveAttribute("target", "_blank");

    // Unlinked user shows the (unlinked) placeholder
    const bobRow = screen.getByText("bob@example.com").closest("tr")!;
    expect(within(bobRow).getByText("(unlinked)")).toBeInTheDocument();

    // Edit button per row
    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(3);
  });
});

describe("UserAdmin — edit flow", () => {
  beforeEach(() => {
    vi.mocked(apiService.getAccounts).mockResolvedValue({ data: accounts });
    vi.mocked(apiService.getFilmUsers).mockResolvedValue({
      data: allLetterboxdUsers,
    });
  });

  it("saves name + lbusername changes and patches the row in place", async () => {
    vi.mocked(apiService.updateAccount).mockResolvedValue({
      data: {
        id: "bob-id",
        email: "bob@example.com",
        name: "Bobby",
        lbusername: "unclaimed-1",
        createdAt: "2026-01-02T00:00:00.000Z",
        updatedAt: "2026-01-04T00:00:00.000Z",
      },
    });

    renderPage();
    await waitFor(() =>
      expect(screen.getByText("bob@example.com")).toBeInTheDocument(),
    );

    // Open the Bob row's edit modal.
    const bobRow = screen.getByText("bob@example.com").closest("tr")!;
    await userEvent.click(within(bobRow).getByRole("button", { name: "Edit" }));

    expect(screen.getByText("Edit account")).toBeInTheDocument();

    const nameInput = screen.getByLabelText("Name") as HTMLInputElement;
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Bobby");

    const lbInput = screen.getByLabelText(
      "Letterboxd username",
    ) as HTMLInputElement;
    await userEvent.type(lbInput, "unclaimed-1");

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    // Only the changed fields are sent.
    await waitFor(() => {
      expect(apiService.updateAccount).toHaveBeenCalledWith(
        "bob-id",
        { name: "Bobby", lbusername: "unclaimed-1" },
        TOKEN,
      );
    });

    // Local list reflects the patch (the modal closed + row updated).
    await waitFor(() => {
      expect(screen.queryByText("Edit account")).not.toBeInTheDocument();
      const newBobRow = screen
        .getByText("bob@example.com")
        .closest("tr")! as HTMLTableRowElement;
      expect(within(newBobRow).getByText("Bobby")).toBeInTheDocument();
      expect(within(newBobRow).getByRole("link", { name: "unclaimed-1" }))
        .toBeInTheDocument();
    });
  });

  it("does not call the API when nothing changed", async () => {

    renderPage();
    await waitFor(() =>
      expect(screen.getByText("admin@example.com")).toBeInTheDocument(),
    );

    const adminRow = screen.getByText("admin@example.com").closest("tr")!;
    await userEvent.click(within(adminRow).getByRole("button", { name: "Edit" }));

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(apiService.updateAccount).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByText("Edit account")).not.toBeInTheDocument(),
    );
  });

  it("unlinks a Letterboxd username by clearing the field", async () => {
    vi.mocked(apiService.updateAccount).mockResolvedValue({
      data: {
        id: "carol-id",
        email: "carol@example.com",
        name: "Carol",
        lbusername: null,
        createdAt: "2026-01-03T00:00:00.000Z",
        updatedAt: "2026-01-04T00:00:00.000Z",
      },
    });

    renderPage();
    await waitFor(() =>
      expect(screen.getByText("carol@example.com")).toBeInTheDocument(),
    );

    const carolRow = screen.getByText("carol@example.com").closest("tr")!;
    await userEvent.click(within(carolRow).getByRole("button", { name: "Edit" }));

    const lbInput = screen.getByLabelText(
      "Letterboxd username",
    ) as HTMLInputElement;
    await userEvent.clear(lbInput);

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(apiService.updateAccount).toHaveBeenCalledWith(
        "carol-id",
        { lbusername: null },
        TOKEN,
      ),
    );
  });

  it("rejects an invalid lbusername format before round-trip", async () => {

    renderPage();
    await waitFor(() =>
      expect(screen.getByText("bob@example.com")).toBeInTheDocument(),
    );

    const bobRow = screen.getByText("bob@example.com").closest("tr")!;
    await userEvent.click(within(bobRow).getByRole("button", { name: "Edit" }));

    const lbInput = screen.getByLabelText(
      "Letterboxd username",
    ) as HTMLInputElement;
    await userEvent.type(lbInput, "x"); // too short

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(apiService.updateAccount).not.toHaveBeenCalled();
    expect(
      screen.getByText(/2–15 characters/),
    ).toBeInTheDocument();
  });

  it("surfaces a 409 conflict from the server inline", async () => {
    vi.mocked(apiService.updateAccount).mockRejectedValue(
      new Error("This Letterboxd.com username has already been claimed."),
    );

    renderPage();
    await waitFor(() =>
      expect(screen.getByText("bob@example.com")).toBeInTheDocument(),
    );

    const bobRow = screen.getByText("bob@example.com").closest("tr")!;
    await userEvent.click(within(bobRow).getByRole("button", { name: "Edit" }));

    const lbInput = screen.getByLabelText(
      "Letterboxd username",
    ) as HTMLInputElement;
    await userEvent.type(lbInput, "unclaimed-1");

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(
        screen.getByText(
          "This Letterboxd.com username has already been claimed.",
        ),
      ).toBeInTheDocument(),
    );
    // Modal stays open so the admin can amend their input.
    expect(screen.getByText("Edit account")).toBeInTheDocument();
  });

  it("offers the current user's lbusername in the datalist (even though it's 'claimed')", async () => {

    renderPage();
    await waitFor(() =>
      expect(screen.getByText("carol@example.com")).toBeInTheDocument(),
    );

    const carolRow = screen.getByText("carol@example.com").closest("tr")!;
    await userEvent.click(within(carolRow).getByRole("button", { name: "Edit" }));

    await waitFor(() => {
      const datalist = document.getElementById("unclaimed-lb-usernames");
      expect(datalist).toBeTruthy();
      const values = Array.from(datalist!.querySelectorAll("option")).map(
        (o) => o.getAttribute("value"),
      );
      // carol-lb is current → included; admin-lb is claimed by someone else → excluded.
      expect(values).toContain("carol-lb");
      expect(values).toContain("unclaimed-1");
      expect(values).toContain("unclaimed-2");
      expect(values).not.toContain("admin-lb");
    });
  });
});

describe("UserAdmin — delete flow", () => {
  beforeEach(() => {
    vi.mocked(apiService.getAccounts).mockResolvedValue({ data: accounts });
    vi.mocked(apiService.getFilmUsers).mockResolvedValue({
      data: allLetterboxdUsers,
    });
  });

  it("removes the row after a confirmed delete", async () => {
    vi.mocked(apiService.deleteAccount).mockResolvedValue({
      data: { id: "bob-id", deleted: true },
    });

    renderPage();
    await waitFor(() =>
      expect(screen.getByText("bob@example.com")).toBeInTheDocument(),
    );

    const bobRow = screen.getByText("bob@example.com").closest("tr")!;
    await userEvent.click(within(bobRow).getByRole("button", { name: "Edit" }));

    await userEvent.click(screen.getByRole("button", { name: "Delete account" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, delete" }));

    await waitFor(() =>
      expect(apiService.deleteAccount).toHaveBeenCalledWith(
        "bob-id",
        TOKEN,
      ),
    );
    await waitFor(() =>
      expect(screen.queryByText("bob@example.com")).not.toBeInTheDocument(),
    );
  });

  it("disables the delete button when editing your own account", async () => {

    renderPage();
    await waitFor(() =>
      expect(screen.getByText("admin@example.com")).toBeInTheDocument(),
    );

    const adminRow = screen.getByText("admin@example.com").closest("tr")!;
    await userEvent.click(within(adminRow).getByRole("button", { name: "Edit" }));

    expect(screen.getByRole("button", { name: "Delete account" })).toBeDisabled();
  });
});
