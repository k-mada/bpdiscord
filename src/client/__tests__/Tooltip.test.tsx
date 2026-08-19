import { render, screen, fireEvent } from "@testing-library/react";
import Tooltip from "../components/Tooltip";

const renderWithButton = () =>
  render(
    <Tooltip content="what this means">
      <button type="button">info</button>
    </Tooltip>,
  );

describe("Tooltip", () => {
  it("describes the trigger via aria-describedby", () => {
    renderWithButton();

    const trigger = screen.getByRole("button", { name: "info" });
    const describedBy = trigger.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();

    const tooltip = document.getElementById(describedBy!);
    expect(tooltip).toHaveAttribute("role", "tooltip");
    expect(tooltip).toHaveTextContent("what this means");
  });

  it("shows on focus and hides on blur", () => {
    renderWithButton();
    const trigger = screen.getByRole("button", { name: "info" });
    const tooltip = document.getElementById(
      trigger.getAttribute("aria-describedby")!,
    )!;

    expect(tooltip).not.toBeVisible();

    fireEvent.focus(trigger);
    expect(tooltip).toBeVisible();

    fireEvent.blur(trigger);
    expect(tooltip).not.toBeVisible();
  });

  it("shows on hover and hides on unhover", () => {
    const { container } = renderWithButton();
    const wrapper = container.firstElementChild!;
    const tooltip = screen.getByRole("tooltip", { hidden: true });

    fireEvent.mouseEnter(wrapper);
    expect(tooltip).toBeVisible();

    fireEvent.mouseLeave(wrapper);
    expect(tooltip).not.toBeVisible();
  });

  // 1.4.13 dismissible: hover can open this with focus somewhere else entirely,
  // so the listener has to be on the document, not the wrapper.
  it("dismisses on Escape while focus is elsewhere", () => {
    render(
      <>
        <button type="button">outside</button>
        <Tooltip content="what this means">
          <button type="button">info</button>
        </Tooltip>
      </>,
    );
    const wrapper = screen.getByRole("button", { name: "info" }).parentElement!;
    const tooltip = screen.getByRole("tooltip", { hidden: true });

    fireEvent.mouseEnter(wrapper);
    expect(tooltip).toBeVisible();

    screen.getByRole("button", { name: "outside" }).focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(tooltip).not.toBeVisible();
  });

  // 1.4.13 persistent: hover and focus are independent sources, so losing one
  // while the other still holds must not hide the description.
  it("stays visible while focused after the pointer leaves", () => {
    renderWithButton();
    const trigger = screen.getByRole("button", { name: "info" });
    const wrapper = trigger.parentElement!;
    const tooltip = screen.getByRole("tooltip", { hidden: true });

    trigger.focus();
    fireEvent.focus(trigger);
    fireEvent.mouseEnter(wrapper);
    fireEvent.mouseLeave(wrapper);

    expect(document.activeElement).toBe(trigger);
    expect(tooltip).toBeVisible();
  });

  it("stays visible while hovered after focus moves away", () => {
    render(
      <>
        <button type="button">outside</button>
        <Tooltip content="what this means">
          <button type="button">info</button>
        </Tooltip>
      </>,
    );
    const trigger = screen.getByRole("button", { name: "info" });
    const wrapper = trigger.parentElement!;
    const tooltip = screen.getByRole("tooltip", { hidden: true });

    fireEvent.focus(trigger);
    fireEvent.mouseEnter(wrapper);
    fireEvent.blur(trigger);

    expect(tooltip).toBeVisible();
  });

  it("re-arms after Escape once both triggers are gone", () => {
    const { container } = renderWithButton();
    const wrapper = container.firstElementChild!;
    const tooltip = screen.getByRole("tooltip", { hidden: true });

    fireEvent.mouseEnter(wrapper);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(tooltip).not.toBeVisible();

    fireEvent.mouseLeave(wrapper);
    fireEvent.mouseEnter(wrapper);
    expect(tooltip).toBeVisible();
  });

  it("adds no tab stop of its own around a non-focusable child", () => {
    const { container } = render(
      <Tooltip content="decorative">
        <div data-testid="bar" />
      </Tooltip>,
    );

    expect(container.querySelectorAll("[tabindex]")).toHaveLength(0);
  });
});
