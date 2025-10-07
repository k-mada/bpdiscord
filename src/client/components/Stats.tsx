import { useState, useEffect } from "react";
import ContentWrapper from "./ContentWrapper";
import { moviesData } from "../constants";
import apiService from "../services/api";
import RatingDistributionHistogram from "./RatingDistributionHistogram";
import Spinner from "./Spinner";

const Dashboard = () => {
  const [totalRatings, setTotalRatings] = useState<any>(null);
  const [loadingUserRatings, setLoadingUserRatings] = useState(true);

  const getRatingsDistribution = async () => {
    try {
      setLoadingUserRatings(true);

      const ratingsDistribution = await apiService.getRatingsDistribution();

      if (ratingsDistribution.data) {
        setTotalRatings(ratingsDistribution.data);
      }
    } catch (error) {
      console.error("Error fetching ratings distribution:", error);
    } finally {
      setLoadingUserRatings(false);
    }
  };

  useEffect(() => {
    getRatingsDistribution();
  }, []);

  const topMoviesWatched = moviesData
    .sort((a, b) => b.usersWatched - a.usersWatched || b.rating - a.rating)
    .slice(0, 24);

  const highestRatedMovies = moviesData
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 12);
  return (
    <ContentWrapper>
      <div className="body-text -prose">
        <p>
          Welcome to the Big Picture Discord. This is a fun project meant to
          augment the Letterboxd experience specifically for the members of this
          Discord.
        </p>
      </div>
      <div className="movie-counter">
        <h3>Movies watched by this Discord:</h3>
        <span className="text-3xl font-bold movie-count">16019</span>
      </div>

      <h3 className="subheading">How we rated of our movies:</h3>
      <div className="flex mb-4 justify-center">
        {loadingUserRatings ? (
          <Spinner />
        ) : (
          <RatingDistributionHistogram distribution={totalRatings} size="md" />
        )}
      </div>
      <h3 className="subheading">Most watched movies</h3>
      <ul className="film-list-small movie-poster-fade-in">
        {topMoviesWatched.map((movie, index) => (
          <li style={{ animationDelay: `${index * 0.2 + 0.5}s` }}>
            <div>
              <img
                src={movie.poster.replace("0-230-0-345", "0-70-0-105")}
                alt={movie.title}
              />
            </div>
          </li>
        ))}
      </ul>
      <h3 className="subheading">Highest rated movies</h3>

      <ul className="film-list movie-poster-fade-in">
        {highestRatedMovies.map((movie, index) => (
          <li style={{ animationDelay: `${index * 0.3 + 0.5}s` }}>
            <div>
              <img src={movie.poster} alt={movie.title} />
              <span className="rating-overlay">★{movie.rating}</span>
            </div>
          </li>
        ))}
      </ul>
    </ContentWrapper>
  );
};

export default Dashboard;
