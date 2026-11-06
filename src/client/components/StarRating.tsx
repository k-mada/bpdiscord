const StarRating = ({ rating }: { rating: number }) => {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 !== 0;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  return (
    <div
      className="star-rating flex items-center"
      role="img"
      aria-label={`${rating} out of 5 stars`}
    >
      {Array.from({ length: fullStars }, (_, i) => (
        <span
          key={`full-${i}`}
          aria-hidden="true"
          className="text-letterboxd-accent"
        >
          ★
        </span>
      ))}

      {hasHalfStar && (
        <div
          key="half"
          aria-hidden="true"
          className="relative inline-block"
        >
          <span className="text-letterboxd-border">☆</span>
          <span
            className="absolute inset-0 text-letterboxd-accent overflow-hidden"
            style={{ width: "50%" }}
          >
            ★
          </span>
        </div>
      )}

      {Array.from({ length: emptyStars }, (_, i) => (
        <span
          key={`empty-${i}`}
          aria-hidden="true"
          className="text-letterboxd-border"
        >
          ☆
        </span>
      ))}
    </div>
  );
};

export default StarRating;
