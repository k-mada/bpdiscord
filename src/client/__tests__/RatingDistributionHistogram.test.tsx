import { fireEvent, render, screen, within } from "@testing-library/react";
import RatingDistributionHistogram from "../components/RatingDistributionHistogram";
import { ALL_RATINGS } from "../constants";

const distribution = [
  { rating: 1, count: 2 },
  { rating: 3, count: 6 },
  { rating: 4.5, count: 12 },
];

// ALL_RATINGS runs 0.5 to 5, so index 5 is the 3-star bucket: 6 of 20 ratings.
const THREE_STAR_INDEX = 5;

const renderHistogram = () => {
  const view = render(
    <RatingDistributionHistogram distribution={distribution} />,
  );
  const chart = screen.getByRole("group", { name: /Rating distribution/ });
  const bar = (index: number) =>
    view.container.querySelector(`[data-bar-index="${index}"]`)!;
  return { ...view, chart, bar };
};

const tooltip = () => screen.queryByTestId("histogram-tooltip");

describe("RatingDistributionHistogram", () => {
  it("exposes every rating as a row in the sr-only table", () => {
    render(<RatingDistributionHistogram distribution={distribution} />);

    const table = screen.getByRole("table", { name: /Rating distribution/ });
    expect(table).toHaveAccessibleName("Rating distribution, 20 ratings");

    for (const rating of ALL_RATINGS) {
      const label = `${rating} ${rating === 1 ? "star" : "stars"}`;
      expect(within(table).getByRole("rowheader", { name: label })).toBeTruthy();
    }

    const row = within(table)
      .getByRole("rowheader", { name: "4.5 stars" })
      .closest("tr")!;
    expect(within(row).getByText("12")).toBeTruthy();
    expect(within(row).getByText("60.0%")).toBeTruthy();
  });

  it("reports zero for ratings absent from the distribution", () => {
    render(<RatingDistributionHistogram distribution={distribution} />);

    const row = screen
      .getByRole("rowheader", { name: "0.5 stars" })
      .closest("tr")!;
    expect(within(row).getByText("0")).toBeTruthy();
    expect(within(row).getByText("0.0%")).toBeTruthy();
  });

  // The bars carry no information the sr-only table does not; exposing both
  // would read the whole distribution twice.
  it("labels the chart and hides its bars from assistive tech", () => {
    const { container, chart } = renderHistogram();

    expect(chart).toHaveAccessibleName("Rating distribution chart, 20 ratings");
    const bars = container.querySelectorAll(".histogram-bar");
    expect(bars).toHaveLength(ALL_RATINGS.length);
    for (const bar of bars) expect(bar).toHaveAttribute("aria-hidden", "true");
  });

  // Renders one per row inside <td> cells on User Comparison and Hater
  // Rankings. Focusable bars would cost ten tab stops per row.
  it("costs one tab stop for the whole chart", () => {
    const { container, chart } = renderHistogram();

    const focusable = container.querySelectorAll(
      "[tabindex], button, a, input, select, textarea, details",
    );
    expect([...focusable]).toEqual([chart]);
    expect(container.querySelector(".histogram-bar [tabindex]")).toBeNull();
  });

  it("shows the rating, count and share of the hovered bar", () => {
    const { bar } = renderHistogram();
    expect(tooltip()).toBeNull();

    fireEvent.mouseOver(bar(THREE_STAR_INDEX));
    expect(tooltip()).toHaveTextContent("3 stars: 6 (30.0%)");

    fireEvent.mouseOver(bar(0));
    expect(tooltip()).toHaveTextContent("0.5 stars: 0 (0.0%)");
  });

  it("hides on pointer leave", () => {
    const { chart, bar } = renderHistogram();

    fireEvent.mouseOver(bar(THREE_STAR_INDEX));
    fireEvent.mouseLeave(chart);

    expect(tooltip()).toBeNull();
  });

  // 1.4.13 dismissible. A hovering pointer user holds no focus, so the key
  // lands on the document rather than the chart.
  it("dismisses on Escape while hovering, and re-shows on the next bar", () => {
    const { bar } = renderHistogram();

    fireEvent.mouseOver(bar(THREE_STAR_INDEX));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(tooltip()).toBeNull();

    fireEvent.mouseOver(bar(THREE_STAR_INDEX + 1));
    expect(tooltip()).toHaveTextContent("3.5 stars");
  });

  it("moves across bars with the arrow keys, clamped at both ends", () => {
    const { chart } = renderHistogram();

    fireEvent.keyDown(chart, { key: "ArrowRight" });
    expect(tooltip()).toHaveTextContent("0.5 stars");

    fireEvent.keyDown(chart, { key: "ArrowLeft" });
    expect(tooltip()).toHaveTextContent("0.5 stars");

    fireEvent.keyDown(chart, { key: "End" });
    expect(tooltip()).toHaveTextContent("5 stars");

    fireEvent.keyDown(chart, { key: "ArrowRight" });
    expect(tooltip()).toHaveTextContent("5 stars");

    fireEvent.keyDown(chart, { key: "Escape" });
    expect(tooltip()).toBeNull();
  });

  it("drops the readout when the chart loses focus", () => {
    const { chart } = renderHistogram();

    fireEvent.keyDown(chart, { key: "Home" });
    expect(tooltip()).not.toBeNull();

    fireEvent.blur(chart);
    expect(tooltip()).toBeNull();
  });

  // UserRatings carries 0 for unrated and dbGetUserRatings does not filter it out.
  // Counting it would make the caption disagree with the rows beneath it.
  it("ignores buckets outside the 0.5-5 range", () => {
    render(
      <RatingDistributionHistogram
        distribution={[...distribution, { rating: 0, count: 480 }]}
      />,
    );

    const table = screen.getByRole("table", { name: /Rating distribution/ });
    expect(table).toHaveAccessibleName("Rating distribution, 20 ratings");
    expect(
      within(table).queryByRole("rowheader", { name: /^0 star/ }),
    ).toBeNull();

    const row = within(table)
      .getByRole("rowheader", { name: "4.5 stars" })
      .closest("tr")!;
    expect(within(row).getByText("60.0%")).toBeTruthy();
  });

  it("reports 0.0% for every rating when nothing is rated", () => {
    render(
      <RatingDistributionHistogram distribution={[{ rating: 0, count: 12 }]} />,
    );

    const table = screen.getByRole("table", { name: /Rating distribution/ });
    expect(table).toHaveAccessibleName("Rating distribution, 0 ratings");
    expect(within(table).getAllByText("0.0%")).toHaveLength(ALL_RATINGS.length);
  });

  it("renders a placeholder when there is no data", () => {
    render(<RatingDistributionHistogram distribution={[]} />);

    expect(screen.getByText("No data")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });
});
