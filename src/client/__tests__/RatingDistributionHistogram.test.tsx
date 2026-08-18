import { render, screen, within } from "@testing-library/react";
import RatingDistributionHistogram from "../components/RatingDistributionHistogram";
import { ALL_RATINGS } from "../constants";

const distribution = [
  { rating: 1, count: 2 },
  { rating: 3, count: 6 },
  { rating: 4.5, count: 12 },
];

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

  it("hides the bars from assistive tech", () => {
    const { container } = render(
      <RatingDistributionHistogram distribution={distribution} />,
    );

    const bars = container.querySelector(".histogram-sm")!;
    expect(bars).toHaveAttribute("aria-hidden", "true");
    expect(bars.querySelectorAll(".histogram-bar")).toHaveLength(
      ALL_RATINGS.length,
    );
  });

  // Renders one per row inside <td> cells on User Comparison. A focusable bar
  // would cost 10 tab stops per row.
  it("contributes no tab stops", () => {
    const { container } = render(
      <RatingDistributionHistogram distribution={distribution} />,
    );

    expect(
      container.querySelectorAll(
        "[tabindex], button, a, input, select, textarea",
      ),
    ).toHaveLength(0);
  });

  it("renders a placeholder when there is no data", () => {
    render(<RatingDistributionHistogram distribution={[]} />);

    expect(screen.getByText("No data")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });
});
