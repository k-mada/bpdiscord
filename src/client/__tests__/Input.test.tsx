import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "../components/ui/Input";

describe("Input", () => {
  it("forwards ref to the underlying <input>", () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it("passes arbitrary native attributes through", () => {
    render(
      <Input
        type="email"
        name="email"
        autoComplete="email"
        placeholder="you@example.test"
        data-testid="email-input"
      />,
    );
    const input = screen.getByTestId("email-input");
    expect(input).toHaveAttribute("type", "email");
    expect(input).toHaveAttribute("name", "email");
    expect(input).toHaveAttribute("autocomplete", "email");
    expect(input).toHaveAttribute("placeholder", "you@example.test");
  });

  it("caller className overrides default conflicting classes (tailwind-merge)", () => {
    // Defaults include px-4; tailwind-merge should leave only the caller's
    // px-2 in the rendered class list.
    render(<Input data-testid="input" className="px-2" />);
    const className = screen.getByTestId("input").className;
    expect(className).toContain("px-2");
    expect(className).not.toContain("px-4");
  });

  it("fires onChange", async () => {
    const onChange = vi.fn();
    render(<Input data-testid="input" onChange={onChange} />);
    await userEvent.type(screen.getByTestId("input"), "abc");
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it("applies the red border class when aria-invalid='true'", () => {
    render(<Input data-testid="input" aria-invalid="true" />);
    // jsdom can only confirm the class and aria attribute are present —
    // Tailwind's aria-invalid: modifier applies in a real browser.
    const input = screen.getByTestId("input");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.className).toContain("aria-invalid:border-letterboxd-error");
  });
});
