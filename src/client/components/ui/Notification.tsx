import { useId } from "react";

export type Status =
  | { type: "idle" }
  | { type: "error"; message: string }
  | { type: "success"; message: string }
  | { type: "info"; message: string };

type Tone = Exclude<Status["type"], "idle">;

interface NotificationProps {
  status: Status;
}

// Both the background and the text colour must stay on one line per entry:
// palette.contrast.test.ts discovers overlay pairings by scanning line by line.
const TONE: Record<Tone, string> = {
  error:
    "bg-letterboxd-error-surface/20 border-letterboxd-error-surface/60 text-letterboxd-error",
  success:
    "bg-letterboxd-success-surface/20 border-letterboxd-success-surface/60 text-letterboxd-success",
  info: "bg-letterboxd-bg-secondary border-letterboxd-border text-letterboxd-text-primary",
};

// Only a failure interrupts. Cutting a screen reader off mid-sentence to report
// that nothing went wrong is hostile, so success and info wait their turn.
const ROLE: Record<Tone, "alert" | "status"> = {
  error: "alert",
  success: "status",
  info: "status",
};

export function Notification({ status }: NotificationProps) {
  // Owned here rather than passed in: every notification gets a stable unique
  // id for a future aria-describedby without any call site having to invent one.
  const id = useId();

  if (status.type === "idle") return null;

  return (
    <div
      id={id}
      role={ROLE[status.type]}
      className={`border rounded-lg p-4 text-sm ${TONE[status.type]}`}
    >
      {status.message}
    </div>
  );
}
