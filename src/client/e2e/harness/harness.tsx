import { createRoot } from "react-dom/client";
import Tooltip from "../../components/Tooltip";
import RatingDistributionHistogram from "../../components/RatingDistributionHistogram";
import "../../index.css";

const DISTRIBUTION = [
  { rating: 1, count: 2 },
  { rating: 3, count: 6 },
  { rating: 4.5, count: 12 },
];

// The spacer pushes the trigger below the fold so Tab has to scroll it into
// view — the condition under which the popup used to mis-anchor.
const Harness = () => (
  <main style={{ padding: 24 }}>
    <button type="button" data-testid="before">
      before
    </button>

    <div data-testid="spacer" style={{ height: "150vh" }} />

    <div style={{ textAlign: "center" }}>
      <Tooltip content="what this means">
        <button type="button" data-testid="trigger">
          info
        </button>
      </Tooltip>
    </div>

    <div data-testid="histogram" style={{ marginTop: 48 }}>
      <RatingDistributionHistogram distribution={DISTRIBUTION} />
    </div>

    <div style={{ height: "150vh" }} />
  </main>
);

createRoot(document.getElementById("root")!).render(<Harness />);
