import { render, screen, fireEvent, act } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { ToastProvider, useToast } from "../contexts/ToastContext";

function Harness() {
  const { show, dismiss } = useToast();
  return (
    <div>
      <button onClick={() => show({ tone: "success", message: "Saved." })}>
        show-success
      </button>
      <button onClick={() => show({ tone: "error", message: "Broke." })}>
        show-error
      </button>
      <button onClick={() => show({ tone: "success", message: "Second." })}>
        show-second
      </button>
      <button onClick={() => dismiss()}>dismiss</button>
    </div>
  );
}

function setup() {
  render(
    <ToastProvider>
      <Harness />
    </ToastProvider>,
  );
}

const click = (label: string) => fireEvent.click(screen.getByText(label));
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
// The visual toast is the only thing carrying the dismiss control; the role=status
// announcement region is persistent, so presence is tracked through the button.
const toastButton = () =>
  screen.queryByRole("button", { name: /dismiss notification/i });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("ToastProvider / useToast", () => {
  it("shows a toast on show()", () => {
    setup();
    click("show-success");
    expect(screen.getByRole("status")).toHaveTextContent("Saved.");
    expect(toastButton()).toBeInTheDocument();
  });

  it("replaces the current toast rather than stacking", () => {
    setup();
    click("show-success");
    click("show-second");
    expect(
      screen.getAllByRole("button", { name: /dismiss notification/i }),
    ).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("Second.");
  });

  it("auto-dismisses a success toast after 5s", () => {
    setup();
    click("show-success");
    advance(5000);
    expect(toastButton()).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("keeps an error toast until dismissed", () => {
    setup();
    click("show-error");
    advance(60000);
    expect(screen.getByRole("status")).toHaveTextContent("Broke.");
    expect(toastButton()).toBeInTheDocument();
  });

  it("pauses the auto-dismiss timer while hovered", () => {
    setup();
    click("show-success");
    const toast = toastButton()!.closest("div")!;
    fireEvent.mouseEnter(toast);
    advance(60000);
    expect(toastButton()).toBeInTheDocument();
    fireEvent.mouseLeave(toast);
    advance(5000);
    expect(toastButton()).not.toBeInTheDocument();
  });

  it("dismisses on the X button", () => {
    setup();
    click("show-success");
    fireEvent.click(toastButton()!);
    expect(toastButton()).not.toBeInTheDocument();
  });

  it("dismisses on Escape", () => {
    setup();
    click("show-success");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(toastButton()).not.toBeInTheDocument();
  });

  it("throws when used outside a provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const Bare = () => {
      useToast();
      return null;
    };
    expect(() => render(<Bare />)).toThrow(/within a ToastProvider/);
    spy.mockRestore();
  });
});
