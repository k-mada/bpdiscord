import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { ToastNotification } from "../components/ui/ToastNotification";

describe("ToastNotification", () => {
  it.each([
    ["error", "alert"],
    ["success", "status"],
    ["info", "status"],
  ] as const)("announces %s as role=%s", (tone, role) => {
    render(<ToastNotification tone={tone} message="Done" onDismiss={() => {}} />);
    expect(screen.getByRole(role)).toHaveTextContent("Done");
  });

  it("exposes a labeled dismiss button that fires onDismiss", async () => {
    const onDismiss = vi.fn();
    render(<ToastNotification tone="success" message="x" onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("pauses on pointer enter and resumes on leave", async () => {
    const onPause = vi.fn();
    const onResume = vi.fn();
    render(
      <ToastNotification
        tone="success"
        message="x"
        onDismiss={() => {}}
        onPause={onPause}
        onResume={onResume}
      />,
    );
    const toast = screen.getByRole("status");
    await userEvent.hover(toast);
    expect(onPause).toHaveBeenCalled();
    await userEvent.unhover(toast);
    expect(onResume).toHaveBeenCalled();
  });

  it("carries a distinct tone per type", () => {
    const { rerender, container } = render(
      <ToastNotification tone="error" message="x" onDismiss={() => {}} />,
    );
    expect(container.firstElementChild!.className).toContain("text-letterboxd-error");
    rerender(<ToastNotification tone="success" message="x" onDismiss={() => {}} />);
    expect(container.firstElementChild!.className).toContain("text-letterboxd-success");
  });
});
