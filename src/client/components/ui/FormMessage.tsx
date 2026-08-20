interface FormMessageProps {
  /** Rendered only when truthy, so call sites stay `<FormError message={x} />`. */
  message?: string | null | undefined;
  /** Set when a field needs to point at this node with aria-describedby. */
  id?: string | undefined;
}

const shell = "border rounded-lg p-4 text-sm";

// role="alert" lives here rather than at the call site: every form-level failure
// in the app announces, without six components each remembering to say so.
export function FormError({ message, id }: FormMessageProps) {
  if (!message) return null;

  return (
    <div
      id={id}
      role="alert"
      className={`${shell} bg-letterboxd-error-surface/20 border-letterboxd-error-surface/60 text-letterboxd-error`}
    >
      {message}
    </div>
  );
}

// role="status", not "alert": success is polite, and interrupting a screen
// reader mid-sentence to report that nothing went wrong is hostile.
export function FormSuccess({ message, id }: FormMessageProps) {
  if (!message) return null;

  return (
    <div
      id={id}
      role="status"
      className={`${shell} bg-letterboxd-success-surface/20 border-letterboxd-success-surface/60 text-letterboxd-success`}
    >
      {message}
    </div>
  );
}
