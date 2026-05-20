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
    // Defaults include px-4. Caller passes px-2. tailwind-merge should keep
    // only the caller's px-2 in the rendered class list. This proves the
    // override semantics work end-to-end.
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
    // We assert the static class is present; the actual CSS application is
    // handled by Tailwind's aria-invalid: modifier at runtime in a browser.
    // What we can verify in jsdom is that the class name is in the list and
    // the aria attribute is set correctly so the variant would activate.
    const input = screen.getByTestId("input");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.className).toContain("aria-invalid:border-red-500");
  });
});
