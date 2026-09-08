import { render, screen, fireEvent, act } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { ToastProvider, useToast } from "../contexts/ToastContext";
import type { Tone } from "../components/ui/tone";

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

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("ToastProvider / useToast", () => {
  it("shows a toast on show()", () => {
    setup();
    click("show-success");
    expect(screen.getByRole("status")).toHaveTextContent("Saved.");
  });

  it("replaces the current toast rather than stacking", () => {
    setup();
    click("show-success");
    click("show-second");
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("Second.");
  });

  it("auto-dismisses a success toast after 5s", () => {
    setup();
    click("show-success");
    advance(5000);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("keeps an error toast until dismissed", () => {
    setup();
    click("show-error");
    advance(60000);
    expect(screen.getByRole("alert")).toHaveTextContent("Broke.");
  });

  it("pauses the auto-dismiss timer while hovered", () => {
    setup();
    click("show-success");
    const toast = screen.getByRole("status");
    fireEvent.mouseEnter(toast);
    advance(60000);
    expect(screen.getByRole("status")).toBeInTheDocument();
    fireEvent.mouseLeave(toast);
    advance(5000);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("dismisses on the X button", () => {
    setup();
    click("show-success");
    fireEvent.click(screen.getByRole("button", { name: /dismiss notification/i }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("dismisses on Escape", () => {
    setup();
    click("show-success");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
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

// Type-only guard so a Tone rename fails here too.
const _tones: Tone[] = ["error", "success", "info"];
void _tones;
