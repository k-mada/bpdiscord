import { render, screen } from "@testing-library/react";
import { BoxOfficeDot } from "../components/MovieFantasyLeague/BoxOfficeDot";
import { isBoxOfficeEligible, BOX_OFFICE_CUTOFF } from "../utilities";

describe("isBoxOfficeEligible", () => {
  it.each([
    ["2026-10-01", false],
    [BOX_OFFICE_CUTOFF, true],
    ["2026-12-25", true],
  ])("%s is eligible: %s", (date, expected) => {
    expect(isBoxOfficeEligible(date)).toBe(expected);
  });

  it("treats an unknown release date as not eligible", () => {
    expect(isBoxOfficeEligible(null)).toBe(false);
  });

  // Comparing Date objects mixed a UTC-parsed cutoff with a locally-parsed
  // release, so the boundary day flipped east of UTC.
  it.each(["America/Los_Angeles", "Europe/Berlin", "Asia/Tokyo"])(
    "decides the cutoff day the same way in %s",
    (timeZone) => {
      const original = process.env.TZ;
      process.env.TZ = timeZone;
      try {
        expect(isBoxOfficeEligible(BOX_OFFICE_CUTOFF)).toBe(true);
        expect(isBoxOfficeEligible("2026-10-01")).toBe(false);
      } finally {
        process.env.TZ = original;
      }
    },
  );
});

describe("BoxOfficeDot", () => {
  it("names the state, so it is not carried by colour alone", () => {
    render(<BoxOfficeDot releaseDate="2026-12-25" />);
    expect(
      screen.getByRole("img", { name: "eligible for box office points" }),
    ).toBeInTheDocument();
  });

  it("names the ineligible state too", () => {
    render(<BoxOfficeDot releaseDate="2026-01-01" />);
    expect(
      screen.getByRole("img", { name: "not eligible for box office points" }),
    ).toBeInTheDocument();
  });

  it("renders nothing when the release date is unknown", () => {
    const { container } = render(<BoxOfficeDot releaseDate={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
