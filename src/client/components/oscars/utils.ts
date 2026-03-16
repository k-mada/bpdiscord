import { OscarsCategory, OscarsPrediction } from "../../types";

export const isCorrectPick = (
  pick: OscarsPrediction,
  cat: OscarsCategory
): boolean => {
  if (cat.actual_winner.length === 0) return false;
  const pickTitleLower = pick.title.toLowerCase();
  return cat.actual_winner.some(
    (w) =>
      pickTitleLower === w.title.toLowerCase() ||
      (w.subtitle && pickTitleLower === w.subtitle.toLowerCase()) ||
      w.title.toLowerCase().startsWith(pickTitleLower)
  );
};
