import { render, screen, within } from "@testing-library/react";

import HaterRankings2 from "../components/HaterRankings2";
import { DialogProvider } from "../contexts/DialogContext";
import { useHaterRankings2 } from "../hooks/useHaterRankings";
import type { HaterRanking2 } from "../types";

vi.mock("../hooks/useHaterRankings");

const row = (overrides: Partial<HaterRanking2>): HaterRanking2 => ({
  displayName: "Member",
  username: "member",
  filmsRated: 100,
  differential: -10,
  adjustedDifferential: -10,
  isDiscord: true,
  ...overrides,
});

function renderWith(rankings: HaterRanking2[]) {
  vi.mocked(useHaterRankings2).mockReturnValue({
    rankings,
    loading: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useHaterRankings2>);
  return render(
    <DialogProvider>
      <HaterRankings2 />
    </DialogProvider>,
  );
}

const rowOf = (name: string) =>
  screen.getByRole("link", { name }).closest("tr")!;

describe("HaterRankings2 — non-Discord marker", () => {
  it("stars a non-Discord user and leaves Discord members unmarked", () => {
    renderWith([
      row({ username: "member", displayName: "Member" }),
      row({ username: "guest", displayName: "Guest", isDiscord: false }),
    ]);

    expect(within(rowOf("Guest")).getByText("(not a Discord member)")).toBeInTheDocument();
    expect(
      within(rowOf("Member")).queryByText("(not a Discord member)"),
    ).not.toBeInTheDocument();
  });

  it("keeps the star outside the profile link", () => {
    renderWith([row({ username: "guest", displayName: "Guest", isDiscord: false })]);

    expect(screen.getByRole("link", { name: "Guest" })).toHaveTextContent(/^Guest$/);
  });

  it("explains the star only when a non-Discord user is listed", () => {
    const { unmount } = renderWith([row({})]);
    expect(screen.queryByText("Not a Discord member")).not.toBeInTheDocument();
    unmount();

    renderWith([row({}), row({ username: "guest", displayName: "Guest", isDiscord: false })]);
    expect(screen.getByText("Not a Discord member")).toBeInTheDocument();
  });
});
