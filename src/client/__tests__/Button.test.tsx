import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button, buttonVariants } from "../components/ui/Button";

describe("Button", () => {
  it("forwards ref to the underlying <button>", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Go</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it("passes arbitrary native attributes through", () => {
    render(
      <Button
        type="submit"
        name="save"
        form="myForm"
        data-testid="btn"
      >
        Save
      </Button>,
    );
    const btn = screen.getByTestId("btn");
    expect(btn).toHaveAttribute("type", "submit");
    expect(btn).toHaveAttribute("name", "save");
    expect(btn).toHaveAttribute("form", "myForm");
  });

  it("caller className overrides default conflicting classes (tailwind-merge)", () => {
    // Defaults include px-4 (md); tailwind-merge should leave only the caller's
    // px-8 in the rendered class list.
    render(
      <Button data-testid="btn" className="px-8">
        Go
      </Button>,
    );
    const className = screen.getByTestId("btn").className;
    expect(className).toContain("px-8");
    expect(className).not.toContain("px-4");
  });

  it("fires onClick", async () => {
    const onClick = vi.fn();
    render(
      <Button data-testid="btn" onClick={onClick}>
        Go
      </Button>,
    );
    await userEvent.click(screen.getByTestId("btn"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("loading implies disabled and sets aria-busy", () => {
    render(
      <Button data-testid="btn" loading>
        Save
      </Button>,
    );
    const btn = screen.getByTestId("btn");
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
  });

  it("does not fire onClick while loading", async () => {
    const onClick = vi.fn();
    render(
      <Button data-testid="btn" loading onClick={onClick}>
        Save
      </Button>,
    );
    await userEvent.click(screen.getByTestId("btn"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("carries cursor-pointer (Tailwind v4 resets buttons to the arrow cursor)", () => {
    render(<Button data-testid="btn">Go</Button>);
    const className = screen.getByTestId("btn").className;
    expect(className).toContain("cursor-pointer");
    expect(className).toContain("disabled:cursor-not-allowed");
  });

  it("renders destructive as a filled button, not a text link", () => {
    render(
      <Button data-testid="btn" variant="destructive">
        Delete
      </Button>,
    );
    const className = screen.getByTestId("btn").className;
    expect(className).toContain("bg-letterboxd-error");
    expect(className).not.toContain("bg-transparent");
  });

  it("does not set aria-busy when not loading", () => {
    render(<Button data-testid="btn">Go</Button>);
    expect(screen.getByTestId("btn")).not.toHaveAttribute("aria-busy");
  });

  it("Button and buttonVariants produce the same classes for the same variant/size", () => {
    render(
      <Button data-testid="btn" variant="secondary" size="sm">
        Go
      </Button>,
    );
    expect(screen.getByTestId("btn").className).toBe(
      buttonVariants({ variant: "secondary", size: "sm" }),
    );
  });
});
