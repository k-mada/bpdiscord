import { render, screen, fireEvent } from "@testing-library/react";
import CollapsibleSection from "../components/CollapsibleSection";

describe("CollapsibleSection", () => {
  it("renders the title and open body by default", () => {
    render(
      <CollapsibleSection title="My List">
        <p>body content</p>
      </CollapsibleSection>,
    );

    expect(
      screen.getByRole("button", { name: /My List/ }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("body content")).toBeInTheDocument();
  });

  it("toggles the body on click", () => {
    render(
      <CollapsibleSection title="My List">
        <p>body content</p>
      </CollapsibleSection>,
    );
    const button = screen.getByRole("button", { name: /My List/ });

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("body content")).not.toBeInTheDocument();

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("body content")).toBeInTheDocument();
  });

  it("respects defaultOpen=false", () => {
    render(
      <CollapsibleSection title="My List" defaultOpen={false}>
        <p>body content</p>
      </CollapsibleSection>,
    );

    expect(
      screen.getByRole("button", { name: /My List/ }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("body content")).not.toBeInTheDocument();
  });
});
