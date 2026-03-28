import { getOrdinalSuffix, formatNominee } from "../components/events/utils";
import { EventNominee } from "../types";

describe("getOrdinalSuffix", () => {
  it('returns "st" for 1', () => {
    expect(getOrdinalSuffix(1)).toBe("st");
  });

  it('returns "nd" for 2', () => {
    expect(getOrdinalSuffix(2)).toBe("nd");
  });

  it('returns "rd" for 3', () => {
    expect(getOrdinalSuffix(3)).toBe("rd");
  });

  it('returns "th" for 4–9', () => {
    for (const n of [4, 5, 6, 7, 8, 9]) {
      expect(getOrdinalSuffix(n)).toBe("th");
    }
  });

  it('returns "th" for teens (11, 12, 13)', () => {
    expect(getOrdinalSuffix(11)).toBe("th");
    expect(getOrdinalSuffix(12)).toBe("th");
    expect(getOrdinalSuffix(13)).toBe("th");
  });

  it("handles 21st, 22nd, 23rd", () => {
    expect(getOrdinalSuffix(21)).toBe("st");
    expect(getOrdinalSuffix(22)).toBe("nd");
    expect(getOrdinalSuffix(23)).toBe("rd");
  });

  it("handles large numbers", () => {
    expect(getOrdinalSuffix(98)).toBe("th");
    expect(getOrdinalSuffix(101)).toBe("st");
    expect(getOrdinalSuffix(111)).toBe("th");
    expect(getOrdinalSuffix(112)).toBe("th");
    expect(getOrdinalSuffix(113)).toBe("th");
    expect(getOrdinalSuffix(121)).toBe("st");
  });
});

describe("formatNominee", () => {
  const nomineeWithPerson: EventNominee = {
    id: "1",
    categoryId: "cat-1",
    personName: "Timothée Chalamet",
    movieOrShowName: "A Complete Unknown",
    isWinner: false,
  };

  const nomineeWithoutPerson: EventNominee = {
    id: "2",
    categoryId: "cat-2",
    personName: null,
    movieOrShowName: "The Brutalist",
    isWinner: true,
  };

  describe("person_first mode", () => {
    it("returns person name as primary when available", () => {
      const result = formatNominee(nomineeWithPerson, "person_first");
      expect(result.primary).toBe("Timothée Chalamet");
      expect(result.secondary).toBe("A Complete Unknown");
    });

    it("falls back to movie name as primary when person name is null", () => {
      const result = formatNominee(nomineeWithoutPerson, "person_first");
      expect(result.primary).toBe("The Brutalist");
      expect(result.secondary).toBe("The Brutalist");
    });
  });

  describe("movie_first mode", () => {
    it("returns movie name as primary", () => {
      const result = formatNominee(nomineeWithPerson, "movie_first");
      expect(result.primary).toBe("A Complete Unknown");
      expect(result.secondary).toBe("Timothée Chalamet");
    });

    it("returns movie name as primary and null secondary when no person", () => {
      const result = formatNominee(nomineeWithoutPerson, "movie_first");
      expect(result.primary).toBe("The Brutalist");
      expect(result.secondary).toBeNull();
    });
  });
});
