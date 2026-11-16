import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import UserAdmin from "../components/admin/UserAdmin";
import apiService from "../services/api";
import { AuthProvider } from "../contexts/AuthContext";
import { DialogProvider } from "../contexts/DialogContext";
import { ToastProvider } from "../contexts/ToastContext";
import type { AccountView, CurrentUser, ProfileView } from "../types";
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
    kind: "account",
    id: "admin-id",
    email: "admin@example.com",
    name: "Admin",
    role: "admin",
    lbusername: "admin-lb",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    kind: "account",
    id: "bob-id",
    email: "bob@example.com",
    name: "Bob",
    role: "member",
    lbusername: null,
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  },
  {
    kind: "account",
    id: "carol-id",
    email: "carol@example.com",
    name: "Carol",
    role: "editor",
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
      <ToastProvider>
        <DialogProvider>
          <MemoryRouter>
            <UserAdmin />
          </MemoryRouter>
        </DialogProvider>
      </ToastProvider>
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

  it("saves name + lbusername changes and shows the updated row", async () => {
    const updatedBob: AccountView = {
      kind: "account",
      id: "bob-id",
      email: "bob@example.com",
      name: "Bobby",
      role: "member",
      lbusername: "unclaimed-1",
      createdAt: "2026-01-02T00:00:00.000Z",
      updatedAt: "2026-01-04T00:00:00.000Z",
    };
    vi.mocked(apiService.updateAccount).mockResolvedValue({ data: updatedBob });
    // A link change reloads the list, which the server now returns updated.
    vi.mocked(apiService.getAccounts)
      .mockResolvedValueOnce({ data: accounts })
      .mockResolvedValueOnce({ data: [accounts[0]!, updatedBob, accounts[2]!] });

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

    // The modal closed and the row shows the update.
    await waitFor(() => {
      expect(screen.queryByText("Edit account")).not.toBeInTheDocument();
      const newBobRow = screen
        .getByText("bob@example.com")
        .closest("tr")! as HTMLTableRowElement;
      expect(within(newBobRow).getByText("Bobby")).toBeInTheDocument();
      expect(
        within(newBobRow).getByRole("link", { name: "unclaimed-1" }),
      ).toBeInTheDocument();
    });
  });

  it("changes a user's role and sends it in the patch", async () => {
    vi.mocked(apiService.updateAccount).mockResolvedValue({
      data: {
        kind: "account",
        id: "bob-id",
        email: "bob@example.com",
        name: "Bob",
        role: "editor",
        lbusername: null,
        createdAt: "2026-01-02T00:00:00.000Z",
        updatedAt: "2026-01-04T00:00:00.000Z",
      },
    });

    renderPage();
    await waitFor(() =>
      expect(screen.getByText("bob@example.com")).toBeInTheDocument(),
    );

    const bobRow = screen.getByText("bob@example.com").closest("tr")!;
    await userEvent.click(within(bobRow).getByRole("button", { name: "Edit" }));

    await userEvent.selectOptions(screen.getByLabelText("Role"), "editor");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(apiService.updateAccount).toHaveBeenCalledWith(
        "bob-id",
        { role: "editor" },
        TOKEN,
      ),
    );

    await waitFor(() => {
      const newBobRow = screen.getByText("bob@example.com").closest("tr")!;
      expect(within(newBobRow).getByText("editor")).toBeInTheDocument();
    });
  });

  it("disables the role dropdown when editing your own account", async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("admin@example.com")).toBeInTheDocument(),
    );

    const adminRow = screen.getByText("admin@example.com").closest("tr")!;
    await userEvent.click(
      within(adminRow).getByRole("button", { name: "Edit" }),
    );

    expect(screen.getByLabelText("Role")).toBeDisabled();
    expect(
      screen.getByText(/can't change your own role/i),
    ).toBeInTheDocument();
  });

  it("does not call the API when nothing changed", async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("admin@example.com")).toBeInTheDocument(),
    );

    const adminRow = screen.getByText("admin@example.com").closest("tr")!;
    await userEvent.click(
      within(adminRow).getByRole("button", { name: "Edit" }),
    );

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(apiService.updateAccount).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByText("Edit account")).not.toBeInTheDocument(),
    );
  });

  it("unlinks a Letterboxd username by clearing the field", async () => {
    vi.mocked(apiService.updateAccount).mockResolvedValue({
      data: {
        kind: "account",
        id: "carol-id",
        email: "carol@example.com",
        name: "Carol",
        role: "editor",
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
    await userEvent.click(
      within(carolRow).getByRole("button", { name: "Edit" }),
    );

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
    expect(screen.getByText(/2–15 characters/)).toBeInTheDocument();
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
    await userEvent.click(
      within(carolRow).getByRole("button", { name: "Edit" }),
    );

    await waitFor(() => {
      const datalist = document.getElementById("unclaimed-lb-usernames");
      expect(datalist).toBeTruthy();
      const values = Array.from(datalist!.querySelectorAll("option")).map((o) =>
        o.getAttribute("value"),
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

    await userEvent.click(
      screen.getByRole("button", { name: "Delete account" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Yes, delete" }));

    await waitFor(() =>
      expect(apiService.deleteAccount).toHaveBeenCalledWith("bob-id", TOKEN),
    );
    await waitFor(() =>
      expect(screen.queryByText("bob@example.com")).not.toBeInTheDocument(),
    );

    // The row is gone, so the confirmation has to live somewhere global.
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Account deleted."),
    );
  });

  it("shows no confirmation toast when the delete fails", async () => {
    vi.mocked(apiService.deleteAccount).mockRejectedValue(
      new Error("Delete failed"),
    );

    renderPage();
    await waitFor(() =>
      expect(screen.getByText("bob@example.com")).toBeInTheDocument(),
    );

    const bobRow = screen.getByText("bob@example.com").closest("tr")!;
    await userEvent.click(within(bobRow).getByRole("button", { name: "Edit" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Delete account" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Yes, delete" }));

    // Inline error inside the still-open modal; no global toast (its persistent
    // live region stays empty, and no dismiss control is rendered).
    expect(await screen.findByRole("alert")).toHaveTextContent("Delete failed");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(
      screen.queryByRole("button", { name: /dismiss notification/i }),
    ).not.toBeInTheDocument();
  });

  it("disables the delete button when editing your own account", async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("admin@example.com")).toBeInTheDocument(),
    );

    const adminRow = screen.getByText("admin@example.com").closest("tr")!;
    await userEvent.click(
      within(adminRow).getByRole("button", { name: "Edit" }),
    );

    expect(
      screen.getByRole("button", { name: "Delete account" }),
    ).toBeDisabled();
  });
});

describe("UserAdmin — non-discord profiles", () => {
  const guest: ProfileView = {
    kind: "profile",
    lbusername: "guest-lb",
    name: "Guest",
    isDiscord: false,
    createdAt: "2026-01-04T00:00:00.000Z",
  };
  const lurker: ProfileView = {
    kind: "profile",
    lbusername: "lurker-lb",
    name: "Lurker",
    isDiscord: true,
    createdAt: "2026-01-05T00:00:00.000Z",
  };

  beforeEach(() => {
    vi.mocked(apiService.getAccounts).mockResolvedValue({
      data: [...accounts, guest, lurker],
    });
    vi.mocked(apiService.getFilmUsers).mockResolvedValue({
      data: [...allLetterboxdUsers, { username: "guest-lb" }],
    });
  });

  const rowFor = async (name: string) =>
    (await screen.findByText(name)).closest("tr")!;

  it("shows N/A for email and role, a star for non-discord, a label for unregistered members", async () => {
    renderPage();

    const guestRow = await rowFor("Guest");
    expect(within(guestRow).getAllByText("N/A")).toHaveLength(2);
    expect(within(guestRow).getByText("(not a Discord member)")).toBeInTheDocument();

    const lurkerRow = await rowFor("Lurker");
    expect(within(lurkerRow).getByText("(unregistered)")).toBeInTheDocument();
    expect(within(lurkerRow).queryByText("(not a Discord member)")).not.toBeInTheDocument();

    const bobRow = await rowFor("Bob");
    expect(within(bobRow).queryByText("N/A")).not.toBeInTheDocument();
  });

  it("adds a person from the modal and lists the new row", async () => {
    vi.mocked(apiService.createProfile).mockResolvedValue({
      data: {
        profile: { ...guest, lbusername: "newbie", name: "Newbie" },
        scrape: { started: true, jobId: "job-1" },
      },
    });
    renderPage();
    await rowFor("Guest");

    await userEvent.click(screen.getByRole("button", { name: "Add non-discord person" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Name"), "  Newbie ");
    await userEvent.type(within(dialog).getByLabelText("Letterboxd username"), "NewBie");
    await userEvent.click(within(dialog).getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(apiService.createProfile).toHaveBeenCalledWith(
        { name: "Newbie", lbusername: "newbie" },
        TOKEN,
      ),
    );
    expect(await screen.findByText("Newbie")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("being scraped");
  });

  it("warns when the profile saved but the scrape did not start", async () => {
    vi.mocked(apiService.createProfile).mockResolvedValue({
      data: {
        profile: { ...guest, lbusername: "newbie", name: "Newbie" },
        scrape: { started: false, error: "Worker unreachable" },
      },
    });
    renderPage();
    await rowFor("Guest");

    await userEvent.click(screen.getByRole("button", { name: "Add non-discord person" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Name"), "Newbie");
    await userEvent.type(within(dialog).getByLabelText("Letterboxd username"), "newbie");
    await userEvent.click(within(dialog).getByRole("button", { name: "Add" }));

    // An error toast persists, so its text lives in the toast and its live region.
    expect(
      await screen.findAllByText(/scrape did not start \(Worker unreachable\)/),
    ).not.toHaveLength(0);
  });

  it("blocks a malformed username before calling the API", async () => {
    renderPage();
    await rowFor("Guest");

    await userEvent.click(screen.getByRole("button", { name: "Add non-discord person" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Name"), "Newbie");
    const lbInput = within(dialog).getByLabelText("Letterboxd username");
    await userEvent.type(lbInput, "has space");
    await userEvent.click(within(dialog).getByRole("button", { name: "Add" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("2–15 characters");
    expect(lbInput).toHaveAttribute("aria-invalid", "true");
    expect(apiService.createProfile).not.toHaveBeenCalled();
  });

  it("keeps the modal open with the server error on a duplicate", async () => {
    vi.mocked(apiService.createProfile).mockRejectedValue(
      new Error("A Letterboxd profile with this username already exists."),
    );
    renderPage();
    await rowFor("Guest");

    await userEvent.click(screen.getByRole("button", { name: "Add non-discord person" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Name"), "Dupe");
    await userEvent.type(within(dialog).getByLabelText("Letterboxd username"), "carol-lb");
    await userEvent.click(within(dialog).getByRole("button", { name: "Add" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("already exists");
  });

  it("edits a profile's name and patches the row", async () => {
    vi.mocked(apiService.updateProfile).mockResolvedValue({
      data: { profile: { ...guest, name: "Guest Star" } },
    });
    renderPage();

    await userEvent.click(within(await rowFor("Guest")).getByRole("button", { name: "Edit" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Edit profile")).toBeInTheDocument();
    const nameInput = within(dialog).getByLabelText("Name");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Guest Star");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(apiService.updateProfile).toHaveBeenCalledWith(
        "guest-lb",
        { name: "Guest Star" },
        TOKEN,
      ),
    );
    expect(await screen.findByText("Guest Star")).toBeInTheDocument();
  });

  it("warns before a username change and sends only the new username", async () => {
    vi.mocked(apiService.updateProfile).mockResolvedValue({
      data: {
        profile: { ...guest, lbusername: "guest-two" },
        scrape: { started: true, jobId: "job-2" },
      },
    });
    renderPage();

    await userEvent.click(within(await rowFor("Guest")).getByRole("button", { name: "Edit" }));
    const dialog = screen.getByRole("dialog");
    const lbInput = within(dialog).getByLabelText("Letterboxd username");
    await userEvent.clear(lbInput);
    await userEvent.type(lbInput, "guest-two");

    expect(lbInput).toHaveAccessibleDescription(/deletes this profile's ratings/);

    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(apiService.updateProfile).toHaveBeenCalledWith(
        "guest-lb",
        { lbusername: "guest-two" },
        TOKEN,
      ),
    );
    expect(await screen.findByRole("link", { name: "guest-two" })).toBeInTheDocument();
  });

  it("deletes a profile by its username after confirmation", async () => {
    vi.mocked(apiService.deleteProfile).mockResolvedValue({ data: {} });
    renderPage();

    await userEvent.click(within(await rowFor("Lurker")).getByRole("button", { name: "Edit" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete profile" }));
    expect(within(dialog).getByText(/leave the Stats page/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Yes, delete" }));

    await waitFor(() =>
      expect(apiService.deleteProfile).toHaveBeenCalledWith("lurker-lb", TOKEN),
    );
    await waitFor(() => expect(screen.queryByText("Lurker")).not.toBeInTheDocument());
    expect(screen.getByRole("status")).toHaveTextContent("Profile deleted.");
  });

  it("reloads the list after linking an account so the claimed profile row disappears", async () => {
    vi.mocked(apiService.updateAccount).mockResolvedValue({
      data: { ...accounts[1]!, lbusername: "guest-lb" } as AccountView,
    });
    renderPage();

    await userEvent.click(within(await rowFor("Bob")).getByRole("button", { name: "Edit" }));
    vi.mocked(apiService.getAccounts).mockResolvedValue({
      data: [accounts[0]!, { ...accounts[1]!, lbusername: "guest-lb" }, accounts[2]!, lurker],
    });
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Letterboxd username"), "guest-lb");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByText("Guest")).not.toBeInTheDocument());
    expect(screen.getByRole("link", { name: "guest-lb" }).closest("tr")).toHaveTextContent(
      "bob@example.com",
    );
  });

  it("still offers an unclaimed profile's username when linking an account", async () => {
    renderPage();

    await userEvent.click(within(await rowFor("Bob")).getByRole("button", { name: "Edit" }));

    await waitFor(() => {
      const values = Array.from(
        document.getElementById("unclaimed-lb-usernames")!.querySelectorAll("option"),
      ).map((o) => o.value);
      expect(values).toContain("guest-lb");
    });
  });
});
