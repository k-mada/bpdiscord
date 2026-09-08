export type Tone = "error" | "success" | "info";

export type Status =
  | { type: "idle" }
  | { type: "error"; message: string }
  | { type: "success"; message: string }
  | { type: "info"; message: string };

// bg + text stay on one line per entry so palette.contrast.test.ts's line scan
// sees the pairing; this file is .tsx so its components/**/*.tsx glob includes it.
export const TONE: Record<Tone, string> = {
  error:
    "bg-letterboxd-error-surface/20 border-letterboxd-error-surface/60 text-letterboxd-error",
  success:
    "bg-letterboxd-success-surface/20 border-letterboxd-success-surface/60 text-letterboxd-success",
  info: "bg-letterboxd-bg-secondary border-letterboxd-border text-letterboxd-text-primary",
};

// Only a failure interrupts. Cutting a screen reader off mid-sentence to report
// success is hostile, so success and info wait their turn (status, not alert).
export const ROLE: Record<Tone, "alert" | "status"> = {
  error: "alert",
  success: "status",
  info: "status",
};
