const StarRating = ({ rating }: { rating: number }) => {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 !== 0;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  return (
    <div className="flex items-center">
      {Array.from({ length: fullStars }, (_, i) => (
        <span key={`full-${i}`} className="text-letterboxd-accent text-lg">
          ★
        </span>
      ))}

      {hasHalfStar && (
        <div key="half" className="relative inline-block text-lg">
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
        <span key={`empty-${i}`} className="text-letterboxd-border text-lg">
          ☆
        </span>
      ))}
    </div>
  );
};

export default StarRating;
