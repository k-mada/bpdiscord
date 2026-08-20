interface FormErrorProps {
  /** Rendered only when truthy, so call sites stay `<FormError message={error} />`. */
  message?: string | null | undefined;
  /** Set when a field needs to point at this node with aria-describedby. */
  id?: string | undefined;
}

// role="alert" lives here rather than at the call site: every form-level failure
// in the app announces, without six components each remembering to say so.
export function FormError({ message, id }: FormErrorProps) {
  if (!message) return null;

  return (
    <div
      id={id}
      role="alert"
      className="bg-letterboxd-error-surface/20 border border-letterboxd-error-surface/60 rounded-lg p-4 text-sm text-letterboxd-error"
    >
      {message}
    </div>
  );
}
