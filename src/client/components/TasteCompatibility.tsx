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
  const calculateCosineSimilarity = (movies: MovieInCommon[]): {
    similarity: number;
    ratedMoviesCount: number;
    totalMoviesCount: number;
    imputation: 'none' | 'weighted';
    weightedDataPoints: number;
  } => {
    if (movies.length === 0) {
      return { similarity: 0, ratedMoviesCount: 0, totalMoviesCount: 0, imputation: 'none', weightedDataPoints: 0 };
    }

    // Separate movies by rating status
    const ratedByBoth = movies.filter(m => m.user1_rating > 0 && m.user2_rating > 0);
    const ratedByUser1Only = movies.filter(m => m.user1_rating > 0 && m.user2_rating === 0);
    const ratedByUser2Only = movies.filter(m => m.user1_rating === 0 && m.user2_rating > 0);

    // If no movies rated by both users, fall back to basic calculation
    if (ratedByBoth.length === 0) {
      return { similarity: 0, ratedMoviesCount: 0, totalMoviesCount: movies.length, imputation: 'none', weightedDataPoints: 0 };
    }

    // Calculate average ratings for imputation
    const user1Ratings = ratedByBoth.map(m => m.user1_rating).concat(ratedByUser1Only.map(m => m.user1_rating));
    const user2Ratings = ratedByBoth.map(m => m.user2_rating).concat(ratedByUser2Only.map(m => m.user2_rating));

    const user1Average = user1Ratings.reduce((sum, r) => sum + r, 0) / user1Ratings.length;
    const user2Average = user2Ratings.reduce((sum, r) => sum + r, 0) / user2Ratings.length;

    // Confidence-based weights
    const WEIGHT_ACTUAL = 1.0;      // Full confidence for actual ratings
    const WEIGHT_IMPUTED = 0.6;     // Reduced confidence for imputed ratings

    // Create comprehensive rating vectors with imputation
    const vector1: number[] = [];
    const vector2: number[] = [];
    const weights: number[] = [];

    // Add movies rated by both users (full confidence)
    ratedByBoth.forEach(movie => {
      vector1.push(movie.user1_rating);
      vector2.push(movie.user2_rating);
      weights.push(WEIGHT_ACTUAL);
    });

    // Add movies rated by user1 only (impute user2's rating with reduced confidence)
    ratedByUser1Only.forEach(movie => {
      vector1.push(movie.user1_rating);
      vector2.push(user2Average); // Imputation
      weights.push(WEIGHT_IMPUTED);
    });

    // Add movies rated by user2 only (impute user1's rating with reduced confidence)
    ratedByUser2Only.forEach(movie => {
      vector1.push(user1Average); // Imputation
      vector2.push(movie.user2_rating);
      weights.push(WEIGHT_IMPUTED);
    });

    // Calculate weighted cosine similarity
    let weightedDotProduct = 0;
    let weightedNorm1 = 0;
    let weightedNorm2 = 0;
    let totalWeight = 0;

    for (let i = 0; i < vector1.length; i++) {
      const weight = weights[i];
      weightedDotProduct += weight * vector1[i] * vector2[i];
      weightedNorm1 += weight * vector1[i] * vector1[i];
      weightedNorm2 += weight * vector2[i] * vector2[i];
      totalWeight += weight;
    }

    if (weightedNorm1 === 0 || weightedNorm2 === 0 || totalWeight === 0) {
      return {
        similarity: 0,
        ratedMoviesCount: ratedByBoth.length,
        totalMoviesCount: movies.length,
        imputation: 'weighted',
        weightedDataPoints: totalWeight
      };
    }

    const similarity = weightedDotProduct / (Math.sqrt(weightedNorm1) * Math.sqrt(weightedNorm2));

    return {
      similarity,
      ratedMoviesCount: ratedByBoth.length,
      totalMoviesCount: movies.length,
      imputation: ratedByUser1Only.length > 0 || ratedByUser2Only.length > 0 ? 'weighted' : 'none',
      weightedDataPoints: Math.round(totalWeight * 10) / 10 // Round to 1 decimal place
    };
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

  const result = calculateCosineSimilarity(moviesInCommon);
  const percentage = Math.round(result.similarity * 100);
  const label = getSimilarityLabel(result.similarity);

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
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="text-lg font-bold text-letterboxd-text-primary min-w-[45px]">
                {percentage}%
              </span>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div className="text-sm font-medium text-letterboxd-accent">
              "{label}"
            </div>
            <div className="text-xs text-letterboxd-text-muted">
              Based on {result.ratedMoviesCount} movies rated by both
              {result.imputation === 'weighted' && result.totalMoviesCount > result.ratedMoviesCount &&
                ` (+${result.totalMoviesCount - result.ratedMoviesCount} additional movies)`
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TasteCompatibility;