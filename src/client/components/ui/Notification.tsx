import { useId } from "react";
import { ROLE, TONE, type Status } from "./tone";

export type { Status };

interface NotificationProps {
  status: Status;
}

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
