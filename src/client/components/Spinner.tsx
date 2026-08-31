interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  /** null marks the spinner decorative, for callers that already announce. */
  label?: string | null;
}

const Spinner = ({ size = "md", label = "Loading" }: SpinnerProps) => {
  const sizeClass =
    size === "sm" ? "h-8 w-8" : size === "md" ? "h-12 w-12" : "h-16 w-16";
  const decorative = label === null;

  return (
    <div
      className="flex justify-center items-center min-h-64 mx-4"
      role={decorative ? undefined : "status"}
      aria-hidden={decorative || undefined}
    >
      <div
        className={`animate-spin rounded-full ${sizeClass} border-b-2 border-letterboxd-accent`}
      ></div>
      {!decorative && <span className="sr-only">{label}</span>}
    </div>
  );
};

export default Spinner;
