const Spinner = ({ size = "md" }: { size?: "sm" | "md" | "lg" }) => {
  const sizeClass =
    size === "sm" ? "h-8 w-8" : size === "md" ? "h-12 w-12" : "h-16 w-16";

  return (
    <div className="flex justify-center items-center min-h-64 mx-4">
      <div
        className={`animate-spin rounded-full ${sizeClass} border-b-2 border-letterboxd-accent`}
      ></div>
    </div>
  );
};

export default Spinner;
