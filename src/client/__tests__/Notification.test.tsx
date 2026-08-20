import { render, screen } from "@testing-library/react";
import { Notification } from "../components/ui/Notification";

describe("Notification", () => {
  it("renders nothing without a message", () => {
    const { container } = render(
      <Notification notificationType="error" message={null} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  // Only a failure interrupts; the other two wait their turn.
  it.each([
    ["error", "alert"],
    ["success", "status"],
    ["info", "status"],
  ] as const)("announces %s as role=%s", (notificationType, role) => {
    render(
      <Notification notificationType={notificationType} message="Heads up" />,
    );
    expect(screen.getByRole(role)).toHaveTextContent("Heads up");
  });

  it("gives each instance a distinct id without the caller supplying one", () => {
    render(
      <>
        <Notification notificationType="info" message="one" />
        <Notification notificationType="info" message="two" />
      </>,
    );
    const [a, b] = screen.getAllByRole("status");
    expect(a!.id).toBeTruthy();
    expect(a!.id).not.toBe(b!.id);
  });

  it("carries a distinct tone per type", () => {
    const { container: err } = render(
      <Notification notificationType="error" message="x" />,
    );
    const { container: ok } = render(
      <Notification notificationType="success" message="x" />,
    );
    const { container: info } = render(
      <Notification notificationType="info" message="x" />,
    );
    const cls = (c: HTMLElement) => c.firstElementChild!.className;
    expect(cls(err)).toContain("text-letterboxd-error");
    expect(cls(ok)).toContain("text-letterboxd-success");
    expect(cls(info)).toContain("text-letterboxd-text-primary");
  });
});
