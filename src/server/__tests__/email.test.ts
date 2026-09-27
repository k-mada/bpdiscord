import { describe, it, expect } from "vitest";
import { canonicalizeEmail } from "../lib/email";

describe("canonicalizeEmail", () => {
  it("strips dots and +tag from a Gmail local part", () => {
    expect(canonicalizeEmail("kevin.k.yamada+1@gmail.com")).toBe(
      "kevinkyamada@gmail.com"
    );
  });

  it("strips dots from Gmail without a +tag", () => {
    expect(canonicalizeEmail("kevin.k.yamada@gmail.com")).toBe(
      "kevinkyamada@gmail.com"
    );
  });

  it("leaves an already-canonical Gmail address unchanged (idempotent)", () => {
    expect(canonicalizeEmail("kevinkyamada@gmail.com")).toBe(
      "kevinkyamada@gmail.com"
    );
  });

  it("applies Gmail rules to googlemail.com too", () => {
    expect(canonicalizeEmail("a.b+tag@googlemail.com")).toBe("ab@googlemail.com");
  });

  it("lowercases and trims", () => {
    expect(canonicalizeEmail("  Kevin.K.Yamada@Gmail.com  ")).toBe(
      "kevinkyamada@gmail.com"
    );
  });

  it("preserves dots and +tag for non-Gmail domains", () => {
    expect(canonicalizeEmail("first.last+work@company.com")).toBe(
      "first.last+work@company.com"
    );
  });

  it("only lowercases/trims a non-Gmail address, nothing else", () => {
    expect(canonicalizeEmail("  First.Last@Example.ORG ")).toBe(
      "first.last@example.org"
    );
  });

  it("returns input untouched when there is no @", () => {
    expect(canonicalizeEmail("not-an-email")).toBe("not-an-email");
  });
});
