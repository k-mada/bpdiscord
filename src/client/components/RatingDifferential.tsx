// renders a horizontal line that shows relatively how negative or positive a user's diffrential per
// 100 movies rated compares to the average Letterboxd rating of all the movies that user rated

function calculatePosition(differential: number): number {
  return differential + 100;
}

const RatingDifferential = ({ differential }: { differential: number }) => {
  return (
    <div className="differential-wrapper">
      <span
        style={{
          marginLeft: `${calculatePosition(differential)}px`,
          display: "inline-block",
        }}
      ></span>
      <div className="differential-line"></div>
      <div className="differential-midpoint"></div>
      <div
        className="differential-rating"
        style={{ left: `${calculatePosition(differential)}px` }}
      >
        <div className="rating-text">{differential}</div>
        <div className="rating-line"></div>
        <div className="rating-marker"></div>
      </div>
    </div>
  );
};

export default RatingDifferential;
