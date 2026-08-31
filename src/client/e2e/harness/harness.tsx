import { createRoot } from "react-dom/client";
import RatingDistributionHistogram from "../../components/RatingDistributionHistogram";
import "../../index.css";

const DISTRIBUTION = [
  { rating: 1, count: 2 },
  { rating: 3, count: 6 },
  { rating: 4.5, count: 12 },
];

// The spacer keeps the histogram below the fold, so a Tab sweep has to travel
// past it to reach the button after it.
const Harness = () => (
  <main style={{ padding: 24 }}>
    <button type="button" data-testid="before">
      before
    </button>

    <div data-testid="spacer" style={{ height: "150vh" }} />

    <div data-testid="histogram" style={{ marginTop: 48 }}>
      <RatingDistributionHistogram distribution={DISTRIBUTION} size="md" />
    </div>

    <div style={{ height: "150vh" }} />

    <button type="button" data-testid="after">
      after
    </button>
  </main>
);

createRoot(document.getElementById("root")!).render(<Harness />);
