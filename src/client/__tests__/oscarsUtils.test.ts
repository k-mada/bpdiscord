import { isCorrectPick } from "../components/oscars/utils";
import { OscarsCategory, OscarsPrediction } from "../types";

const makePick = (title: string): OscarsPrediction => ({
  title,
  subtitle: "",
});

const makeCategory = (
  winners: Array<{ title: string; subtitle?: string }>
): OscarsCategory => ({
  order: 1,
  category: "Best Picture",
  nominees: [],
  pick_sean: makePick(""),
  pick_amanda: makePick(""),
  pick_sean_should_win: makePick(""),
  pick_amanda_should_win: makePick(""),
  winner: winners[0]?.title ?? "",
  actual_winner: winners.map((w) => ({
    title: w.title,
    subtitle: w.subtitle ?? "",
  })),
});

describe("isCorrectPick", () => {
  it("returns true for exact title match (case-insensitive)", () => {
    const pick = makePick("the brutalist");
    const cat = makeCategory([{ title: "The Brutalist" }]);
    expect(isCorrectPick(pick, cat)).toBe(true);
  });

  it("returns true for subtitle match", () => {
    const pick = makePick("a complete unknown");
    const cat = makeCategory([
      { title: "Timothée Chalamet", subtitle: "A Complete Unknown" },
    ]);
    expect(isCorrectPick(pick, cat)).toBe(true);
  });

  it("returns true for prefix match (startsWith)", () => {
    const pick = makePick("the brutalist");
    const cat = makeCategory([{ title: "The Brutalist (2024)" }]);
    expect(isCorrectPick(pick, cat)).toBe(true);
  });

  it("returns false when no winners exist", () => {
    const pick = makePick("Anora");
    const cat = makeCategory([]);
    expect(isCorrectPick(pick, cat)).toBe(false);
  });

  it("returns false for non-matching pick", () => {
    const pick = makePick("Conclave");
    const cat = makeCategory([{ title: "Anora" }]);
    expect(isCorrectPick(pick, cat)).toBe(false);
  });

  it("handles multiple winners", () => {
    const pick = makePick("emilia pérez");
    const cat = makeCategory([
      { title: "Anora" },
      { title: "Emilia Pérez" },
    ]);
    expect(isCorrectPick(pick, cat)).toBe(true);
  });
});
