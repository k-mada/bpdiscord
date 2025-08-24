import React from "react";

interface Rating {
  rating: number;
  count: number;
}

interface UserData {
  username: string;
  displayName?: string;
  ratings: Rating[];
}

interface MovieInCommon {
  title: string;
  user1_rating: number;
  user2_rating: number;
}

interface TasteCompatibilityProps {
  user1Data: UserData | null;
  user2Data: UserData | null;
  moviesInCommon: MovieInCommon[];
}

const TasteCompatibility = ({
  user1Data,
  user2Data,
  moviesInCommon,
}: TasteCompatibilityProps) => {
  const calculateCosineSimilarity = (movies: MovieInCommon[]): { similarity: number; ratedMoviesCount: number } => {
    // Filter to only movies that both users have rated (rating > 0)
    const ratedByBoth = movies.filter(
      movie => movie.user1_rating > 0 && movie.user2_rating > 0
    );

    if (ratedByBoth.length === 0) {
      return { similarity: 0, ratedMoviesCount: 0 };
    }

    // Create vectors from the ratings of movies both users rated
    const vector1 = ratedByBoth.map(movie => movie.user1_rating);
    const vector2 = ratedByBoth.map(movie => movie.user2_rating);

    // Calculate cosine similarity
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vector1.length; i++) {
      dotProduct += vector1[i] * vector2[i];
      norm1 += vector1[i] * vector1[i];
      norm2 += vector2[i] * vector2[i];
    }

    if (norm1 === 0 || norm2 === 0) {
      return { similarity: 0, ratedMoviesCount: ratedByBoth.length };
    }

    const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    return { similarity, ratedMoviesCount: ratedByBoth.length };
  };

  const getSimilarityLabel = (similarity: number): string => {
    if (similarity >= 0.9) return "Nearly Identical Taste";
    if (similarity >= 0.75) return "Very Similar Taste";
    if (similarity >= 0.5) return "Somewhat Similar";
    if (similarity >= 0.25) return "Different Taste";
    return "Opposite Taste";
  };

  if (!user1Data || !user2Data || !moviesInCommon.length) {
    return null;
  }

  const { similarity, ratedMoviesCount } = calculateCosineSimilarity(moviesInCommon);
  const similarityPercentage = Math.round(similarity * 100);
  const similarityLabel = getSimilarityLabel(similarity);

  return (
    <div className="card">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1">
          <h4 className="text-xl font-semibold text-letterboxd-text-primary mb-2 flex items-center gap-2">
            🎯 Taste Compatibility
          </h4>
          <div className="text-sm text-letterboxd-text-secondary">
            {user1Data.displayName || user1Data.username} vs {user2Data.displayName || user2Data.username}
          </div>
        </div>
        
        <div className="flex-1 max-w-md">
          {/* Similarity Bar */}
          <div className="mb-2">
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-letterboxd-bg-primary rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-letterboxd-accent to-green-400 transition-all duration-500"
                  style={{ width: `${similarityPercentage}%` }}
                />
              </div>
              <span className="text-lg font-bold text-letterboxd-text-primary min-w-[45px]">
                {similarityPercentage}%
              </span>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div className="text-sm font-medium text-letterboxd-accent">
              "{similarityLabel}"
            </div>
            <div className="text-xs text-letterboxd-text-muted">
              Based on {ratedMoviesCount} movies rated by both
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TasteCompatibility;