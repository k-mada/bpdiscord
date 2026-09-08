import { ROLE, TONE, type Tone } from "./tone";

interface ToastNotificationProps {
  tone: Tone;
  message: string;
  onDismiss: () => void;
  /** Pause/resume the auto-dismiss timer while the user is hovering or reading. */
  onPause?: () => void;
  onResume?: () => void;
}

export function ToastNotification({
  tone,
  message,
  onDismiss,
  onPause,
  onResume,
}: ToastNotificationProps) {
  return (
    <div
      role={ROLE[tone]}
      className={`animate-slide-down pointer-events-auto flex items-center gap-3 border rounded-lg p-4 text-sm shadow-lg ${TONE[tone]}`}
      onMouseEnter={onPause}
      onMouseLeave={onResume}
      onFocus={onPause}
      onBlur={onResume}
    >
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="shrink-0 -mr-1 rounded p-1 opacity-70 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-letterboxd-accent"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M5 5l10 10M15 5L5 15" />
        </svg>
      </button>
    </div>
  );
}
