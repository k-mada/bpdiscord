import { render, screen } from "@testing-library/react";
import Spinner from "../components/Spinner";

describe("Spinner", () => {
  it("announces itself by default", () => {
    render(<Spinner />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading");
  });

  it("takes a caller-supplied label", () => {
    render(<Spinner label="Fetching ratings" />);

    expect(screen.getByRole("status")).toHaveTextContent("Fetching ratings");
  });

  // JobProgress renders one per phase row, inside a container that already
  // carries role=status. Nesting live regions announces the row twice.
  it("goes silent when the caller already announces", () => {
    const { container } = render(<Spinner label={null} />);

    expect(screen.queryByRole("status")).toBeNull();
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
    expect(container.textContent).toBe("");
  });
});
