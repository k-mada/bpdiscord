import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axeViolations } from "./helpers/axe";
import DesktopTable from "../components/events/DesktopTable";
import MobileTable from "../components/events/MobileTable";
import { EventCategory } from "../types";

const categories: EventCategory[] = [
  {
    id: "cat-1",
    eventId: "evt-1",
    name: "Best Picture",
    displayOrder: 1,
    displayMode: "movie_first",
    nominees: [
      {
        id: "nom-1",
        categoryId: "cat-1",
        personName: null,
        movieOrShowName: "Anora",
        isWinner: true,
      },
      {
        id: "nom-2",
        categoryId: "cat-1",
        personName: null,
        movieOrShowName: "Conclave",
        isWinner: false,
      },
    ],
  },
  {
    id: "cat-2",
    eventId: "evt-1",
    name: "Best Director",
    displayOrder: 2,
    displayMode: "person_first",
    nominees: [
      {
        id: "nom-3",
        categoryId: "cat-2",
        personName: "Sean Baker",
        movieOrShowName: "Anora",
        isWinner: false,
      },
    ],
  },
];

describe("Events DesktopTable", () => {
  it("exposes table semantics the CSS grid cannot carry", () => {
    render(<DesktopTable categories={categories} onCategoryTap={() => {}} />);

    expect(
      screen.getByRole("table", { name: "Winners by category" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(3);
    expect(
      screen.getAllByRole("columnheader").map((el) => el.textContent),
    ).toEqual(["Category", "Winner"]);
    expect(screen.getAllByRole("rowheader")).toHaveLength(2);
    expect(screen.getAllByRole("cell")).toHaveLength(2);
  });

  it("opens the nominees modal from the keyboard-reachable category button", async () => {
    const onCategoryTap = vi.fn();
    render(
      <DesktopTable categories={categories} onCategoryTap={onCategoryTap} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Best Picture" }));

    expect(onCategoryTap).toHaveBeenCalledWith(categories[0]);
  });

  it("says an undecided category is not announced", () => {
    render(<DesktopTable categories={categories} onCategoryTap={() => {}} />);

    expect(screen.getByText("Not announced")).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <DesktopTable categories={categories} onCategoryTap={() => {}} />,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe("Events MobileTable", () => {
  it("names its columns even though it renders no visible header", () => {
    render(<MobileTable categories={categories} onCategoryTap={() => {}} />);

    expect(
      screen.getAllByRole("columnheader").map((el) => el.textContent),
    ).toEqual(["Category", "Winner"]);
    expect(screen.getAllByRole("rowheader")).toHaveLength(2);
    expect(screen.getAllByRole("cell")).toHaveLength(2);
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <MobileTable categories={categories} onCategoryTap={() => {}} />,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
