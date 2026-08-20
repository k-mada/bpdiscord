import { useId } from "react";

export type NotificationType = "success" | "error" | "info";

interface NotificationProps {
  notificationType: NotificationType;
  message: string;
}

// Both the background and the text colour must stay on one line per entry:
// palette.contrast.test.ts discovers overlay pairings by scanning line by line.
const TONE: Record<NotificationType, string> = {
  error:
    "bg-letterboxd-error-surface/20 border-letterboxd-error-surface/60 text-letterboxd-error",
  success:
    "bg-letterboxd-success-surface/20 border-letterboxd-success-surface/60 text-letterboxd-success",
  info: "bg-letterboxd-bg-secondary border-letterboxd-border text-letterboxd-text-primary",
};

// Only a failure interrupts. Success and info are announced politely, because
// cutting a screen reader off mid-sentence to report that nothing went wrong is
// hostile — that politeness difference is the whole point of the two roles.
const ROLE: Record<NotificationType, "alert" | "status"> = {
  error: "alert",
  success: "status",
  info: "status",
};

export function Notification({ notificationType, message }: NotificationProps) {
  // Owned here rather than passed in: every notification gets a stable unique
  // id for a future aria-describedby without any call site having to invent one.
  const id = useId();

  return (
    <div
      id={id}
      role={ROLE[notificationType]}
      className={`border rounded-lg p-4 text-sm ${TONE[notificationType]}`}
    >
      {message}
    </div>
  );
}
