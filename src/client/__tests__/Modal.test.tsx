import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal, ModalHeader, ModalBody } from "../components/Modal";
import { DialogProvider } from "../contexts/DialogContext";

function Harness({ placement }: { placement?: "center" | "bottom" }) {
  const [open, setOpen] = useState(false);
  return (
    <DialogProvider>
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
    </DialogProvider>
  );
}

function TwoDialogs() {
  const [a, setA] = useState(true);
  const [b, setB] = useState(true);
  return (
    <DialogProvider>
      <button>Behind</button>
      <Modal isOpen={a} onClose={() => setA(false)}>
        <ModalHeader onClose={() => setA(false)}>First dialog</ModalHeader>
        <ModalBody>
          <button onClick={() => setB(false)}>Close the other</button>
        </ModalBody>
      </Modal>
      <Modal isOpen={b} onClose={() => setB(false)}>
        <ModalHeader onClose={() => setB(false)}>Second dialog</ModalHeader>
        <ModalBody>b</ModalBody>
      </Modal>
    </DialogProvider>
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
    const app = container.firstElementChild;
    expect(app).not.toHaveAttribute("aria-hidden");

    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(app).toHaveAttribute("aria-hidden", "true");
    expect(app).toHaveAttribute("inert");

    await userEvent.keyboard("{Escape}");
    expect(app).not.toHaveAttribute("aria-hidden");
    expect(app).not.toHaveAttribute("inert");
  });

  it("keeps the app hidden until the last dialog closes", async () => {
    const { container } = render(<TwoDialogs />);
    const app = container.firstElementChild;
    expect(app).toHaveAttribute("aria-hidden", "true");

    await userEvent.click(
      screen.getByRole("button", { name: "Close the other" }),
    );
    expect(
      screen.getByRole("dialog", { name: "First dialog" }),
    ).toBeInTheDocument();
    expect(app).toHaveAttribute("aria-hidden", "true");
    expect(document.documentElement.style.overflow).toBe("hidden");

    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(app).not.toHaveAttribute("aria-hidden");
    expect(document.documentElement.style.overflow).not.toBe("hidden");
  });

  it("renders a bottom sheet when asked", async () => {
    render(<Harness placement="bottom" />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("dialog").className).toContain("rounded-t-2xl");
  });

  it("Escape closes only the topmost dialog", async () => {
    render(<TwoDialogs />);
    expect(screen.getAllByRole("dialog")).toHaveLength(2);

    await userEvent.keyboard("{Escape}");
    const remaining = screen.getAllByRole("dialog");
    expect(remaining).toHaveLength(1);
    expect(
      screen.getByRole("dialog", { name: "First dialog" }),
    ).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("never points aria-labelledby at an element that does not exist", () => {
    render(
      <DialogProvider>
        <Modal isOpen onClose={() => {}}>
          <ModalBody>body</ModalBody>
        </Modal>
      </DialogProvider>,
    );
    const target = screen
      .getByRole("dialog")
      .getAttribute("aria-labelledby");
    expect(target === null || document.getElementById(target)).toBeTruthy();
  });

  it("skips hidden elements when wrapping focus", async () => {
    render(
      <DialogProvider>
        <Modal isOpen onClose={() => {}} label="Trap">
          <ModalBody>
            <button style={{ display: "none" }}>Hidden</button>
            <button>Visible</button>
          </ModalBody>
        </Modal>
      </DialogProvider>,
    );
    screen.getByRole("button", { name: "Visible" }).focus();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Visible" })).toHaveFocus();
  });
});
