import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axeViolations } from "./helpers/axe";
import DesktopTable from "../components/oscars/DesktopTable";
import MobileTable from "../components/oscars/MobileTable";
import StickyToggle from "../components/oscars/StickyToggle";
import { OscarsCategory, OscarsPrediction } from "../types";

const pick = (title: string, subtitle = ""): OscarsPrediction => ({
  title,
  subtitle,
});

// Inline, never the shipped oscars JSON: that file is swapped every season.
const categories: OscarsCategory[] = [
  {
    order: 1,
    category: "Best Picture",
    nominees: [pick("Anora"), pick("Conclave")],
    pick_sean: pick("Anora"),
    pick_amanda: pick("Conclave"),
    pick_sean_should_win: pick("Anora"),
    pick_amanda_should_win: pick("Conclave"),
    winner: "sean",
    actual_winner: [pick("Anora")],
  },
  {
    order: 2,
    category: "Director",
    nominees: [pick("Sean Baker")],
    pick_sean: pick("Sean Baker"),
    pick_amanda: pick("Brady Corbet"),
    pick_sean_should_win: pick("Sean Baker"),
    pick_amanda_should_win: pick("Brady Corbet"),
    winner: "",
    actual_winner: [],
  },
];

const tableProps = {
  categories,
  getSeanPick: (cat: OscarsCategory) => cat.pick_sean,
  getAmandaPick: (cat: OscarsCategory) => cat.pick_amanda,
  viewMode: "will_win" as const,
};

describe("Oscars DesktopTable", () => {
  it("exposes table semantics the CSS grid cannot carry", () => {
    render(<DesktopTable {...tableProps} onCategoryTap={() => {}} />);

    expect(
      screen.getByRole("table", { name: "Predictions by category" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(3);
    expect(
      screen.getAllByRole("columnheader").map((el) => el.textContent),
    ).toEqual(["Category", "Sean", "Amanda", "Winner"]);
    expect(screen.getAllByRole("rowheader")).toHaveLength(2);
    expect(screen.getAllByRole("cell")).toHaveLength(6);
  });

  it("opens the nominees modal from the keyboard-reachable category button", async () => {
    const onCategoryTap = vi.fn();
    render(<DesktopTable {...tableProps} onCategoryTap={onCategoryTap} />);

    await userEvent.click(screen.getByRole("button", { name: "Best Picture" }));

    expect(onCategoryTap).toHaveBeenCalledWith(categories[0]);
  });

  it("states the winner and the correct pick in text, not only in colour", () => {
    render(<DesktopTable {...tableProps} onCategoryTap={() => {}} />);

    expect(screen.getByText(". Won this category")).toBeInTheDocument();
    expect(screen.getAllByText("Correct pick.")).toHaveLength(1);
    expect(screen.getByText("Not announced")).toBeInTheDocument();
  });

  it("hides the trophy from assistive technology", () => {
    const { container } = render(
      <DesktopTable {...tableProps} onCategoryTap={() => {}} />,
    );

    const trophy = container.querySelector('[aria-hidden="true"]');
    expect(trophy).toHaveTextContent("\u{1F3C6}");
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <DesktopTable {...tableProps} onCategoryTap={() => {}} />,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe("Oscars MobileTable", () => {
  it("keeps the header column count equal to the row cell count", () => {
    render(<MobileTable {...tableProps} onCategoryTap={() => {}} />);

    expect(
      screen.getAllByRole("columnheader").map((el) => el.textContent),
    ).toEqual(["Category", "Sean", "Amanda", "Winner"]);
    expect(screen.getAllByRole("rowheader")).toHaveLength(2);
    expect(screen.getAllByRole("cell")).toHaveLength(6);
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <MobileTable {...tableProps} onCategoryTap={() => {}} />,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe("StickyToggle", () => {
  it("reports which view mode is active", () => {
    render(<StickyToggle viewMode="will_win" setViewMode={() => {}} />);

    expect(screen.getByRole("group", { name: "View mode" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Who Will Win" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "Who Should Win" }),
    ).toHaveAttribute("aria-pressed", "false");
  });
});
