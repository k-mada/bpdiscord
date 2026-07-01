import { render, screen, fireEvent } from "@testing-library/react";
import CollapsibleSection from "../components/CollapsibleSection";

describe("CollapsibleSection", () => {
  it("renders the title, an open body, and wires aria-controls to it", () => {
    render(
      <CollapsibleSection title="My List">
        <p>body content</p>
      </CollapsibleSection>,
    );

    const button = screen.getByRole("button", { name: /My List/ });
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("body content")).toBeVisible();

    const controlsId = button.getAttribute("aria-controls");
    expect(controlsId).toBeTruthy();
    expect(document.getElementById(controlsId!)).toHaveTextContent(
      "body content",
    );
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
    expect(screen.getByText("body content")).not.toBeVisible();

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("body content")).toBeVisible();
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
    expect(screen.getByText("body content")).not.toBeVisible();
  });
});
