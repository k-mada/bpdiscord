import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal, ModalHeader, ModalBody } from "../components/Modal";

function Harness({ placement }: { placement?: "center" | "bottom" }) {
  const [open, setOpen] = useState(false);
  return (
    <div id="root">
      <button onClick={() => setOpen(true)}>Open</button>
      <button>Behind</button>
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        {...(placement && { placement })}
      >
        <ModalHeader onClose={() => setOpen(false)}>How it works</ModalHeader>
        <ModalBody>
          <button>First</button>
          <button>Second</button>
        </ModalBody>
      </Modal>
    </div>
  );
}

describe("Modal", () => {
  it("names the dialog from its header", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(
      screen.getByRole("dialog", { name: "How it works" }),
    ).toBeInTheDocument();
  });

  it("gives the close control an accessible name", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("moves focus into the dialog and returns it on close", async () => {
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open" });
    await userEvent.click(trigger);
    expect(screen.getByRole("dialog")).toHaveFocus();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("wraps Tab within the dialog", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));

    const close = screen.getByRole("button", { name: "Close" });
    const second = screen.getByRole("button", { name: "Second" });

    await userEvent.tab();
    expect(close).toHaveFocus();

    second.focus();
    await userEvent.tab();
    expect(close).toHaveFocus();

    await userEvent.tab({ shift: true });
    expect(second).toHaveFocus();
  });

  it("hides the rest of the app while open", async () => {
    const { container } = render(<Harness />);
    const root = container.querySelector("#root");
    expect(root).not.toHaveAttribute("aria-hidden");

    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root).toHaveAttribute("inert");

    await userEvent.keyboard("{Escape}");
    expect(root).not.toHaveAttribute("aria-hidden");
  });

  it("renders a bottom sheet when asked", async () => {
    render(<Harness placement="bottom" />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("dialog").className).toContain("rounded-t-2xl");
  });
});
