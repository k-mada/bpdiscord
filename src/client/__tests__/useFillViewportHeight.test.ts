import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useFillViewportHeight } from "../hooks/useFillViewportHeight";

const setViewportHeight = (h: number) =>
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: h,
  });

const elementWithTop = (top: number) =>
  ({ getBoundingClientRect: () => ({ top }) }) as HTMLDivElement;

afterEach(() => setViewportHeight(768));

describe("useFillViewportHeight", () => {
  it("measures when the element attaches, not on mount", () => {
    setViewportHeight(900);
    const { result } = renderHook(() => useFillViewportHeight(32));

    // The container renders after data loads, so nothing is measured yet.
    expect(result.current.maxHeight).toBeUndefined();

    act(() => result.current.ref(elementWithTop(100)));
    expect(result.current.maxHeight).toBe(900 - 100 - 32);
  });

  it("recomputes on window resize", () => {
    setViewportHeight(900);
    const { result } = renderHook(() => useFillViewportHeight(32));
    act(() => result.current.ref(elementWithTop(100)));

    act(() => {
      setViewportHeight(500);
      window.dispatchEvent(new Event("resize"));
    });
    expect(result.current.maxHeight).toBe(500 - 100 - 32);
  });

  it("never returns a negative height", () => {
    setViewportHeight(200);
    const { result } = renderHook(() => useFillViewportHeight(32));
    act(() => result.current.ref(elementWithTop(400)));
    expect(result.current.maxHeight).toBe(0);
  });
});
