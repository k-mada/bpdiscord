import { render, screen } from "@testing-library/react";
import { Notification } from "../components/ui/Notification";

describe("Notification", () => {
  // Only a failure interrupts; the other two wait their turn.
  it.each([
    ["error", "alert"],
    ["success", "status"],
    ["info", "status"],
  ] as const)("announces %s as role=%s", (type, role) => {
    render(<Notification status={{ type, message: "Heads up" }} />);
    expect(screen.getByRole(role)).toHaveTextContent("Heads up");
  });

  it("renders nothing when idle, so no call site has to gate", () => {
    const { container } = render(<Notification status={{ type: "idle" }} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("gives each instance a distinct id without the caller supplying one", () => {
    render(
      <>
        <Notification status={{ type: "info", message: "one" }} />
        <Notification status={{ type: "info", message: "two" }} />
      </>,
    );
    const [a, b] = screen.getAllByRole("status");
    expect(a!.id).toBeTruthy();
    expect(a!.id).not.toBe(b!.id);
  });

  it("carries a distinct tone per type", () => {
    const { container: err } = render(
      <Notification status={{ type: "error", message: "x" }} />,
    );
    const { container: ok } = render(
      <Notification status={{ type: "success", message: "x" }} />,
    );
    const { container: info } = render(
      <Notification status={{ type: "info", message: "x" }} />,
    );
    const cls = (c: HTMLElement) => c.firstElementChild!.className;
    expect(cls(err)).toContain("text-letterboxd-error");
    expect(cls(ok)).toContain("text-letterboxd-success");
    expect(cls(info)).toContain("text-letterboxd-text-primary");
  });
});
