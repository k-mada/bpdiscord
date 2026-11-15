import { render, screen } from "@testing-library/react";

import TasteCompatibility from "../components/TasteCompatibility";
import type { MovieInCommon } from "../types";

const film = (poster: string | null): MovieInCommon => ({
  title: "Heat",
  film_slug: "heat",
  user1_rating: 5,
  user2_rating: 5,
  poster,
  year: 1995,
  letterboxd_url: null,
  total_ratings: 10,
});

function renderWith(poster: string | null) {
  return render(
    <TasteCompatibility
      user1Data={{ username: "rooney" }}
      user2Data={{ username: "mara" }}
      moviesInCommon={[film(poster)]}
      compatibility={{ pearson: 0.4, mad: 0.8, sampleSize: 20 }}
    />,
  );
}

describe("TasteCompatibility anchor posters", () => {
  it.each([
    ["the stored 230px crop", "0-230-0-345"],
    ["an oversized 1000px crop", "0-1000-0-1500"],
  ])("requests a 150px poster from %s", (_label, crop) => {
    renderWith(`https://a.ltrbxd.com/resized/film-poster/heat-${crop}-crop.jpg`);

    const img = screen.getByAltText("Heat");
    expect(img).toHaveAttribute(
      "src",
      "https://a.ltrbxd.com/resized/film-poster/heat-0-150-0-225-crop.jpg",
    );
    expect(img.getAttribute("srcset")).toContain("heat-0-300-0-450-crop.jpg 2x");
  });

  it("fixes the column width so the poster cannot stretch it", () => {
    renderWith("https://a.ltrbxd.com/resized/film-poster/heat-0-1000-0-1500-crop.jpg");

    const column = screen.getByText("Shared fave").parentElement!;
    expect(column).toHaveClass("w-[120px]", "sm:w-[150px]");
  });
});
