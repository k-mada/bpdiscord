import { useState, useEffect } from "react";
import apiService from "../services/api";
import RatingDistributionHistogram from "./RatingDistributionHistogram";
import UserFilmsCount from "./UserFilmsCount";
import type { LBFilm } from "../types";
import { useRatingsDistribution } from "../hooks/useRatingsDistribution";
import Spinner from "./Spinner";
import MovieList from "./MovieList";

const Dashboard = () => {
  const [topWatchedFilms, setTopWatchedFilms] = useState<LBFilm[]>([]);
  const [topRatedUserFilms, setTopRatedUserFilms] = useState<LBFilm[]>([]);

  const { data: allRatings, loading } = useRatingsDistribution();

  const getTopWatchedFilms = async () => {
    try {
      const topWatchedFilms = await apiService.getTopWatchedFilms();
      setTopWatchedFilms(topWatchedFilms.data || []);
    } catch (error) {
      console.error("Error fetching top watched films:", error);
    }
  };

  const getTopRatedUserFilms = async () => {
    try {
      const topRatedUserFilms = await apiService.getTopRatedUserFilms();
      setTopRatedUserFilms(topRatedUserFilms.data || []);
    } catch (error) {
      console.error("Error fetching top rated user films:", error);
    }
  };

  useEffect(() => {
    getTopWatchedFilms();
    getTopRatedUserFilms();
  }, []);

  return (
    <div>
      <div className="body-text -prose">
        <p>
          Welcome to the Big Picture Discord. This is a fun project meant to
          augment the Letterboxd experience specifically for the members of this
          Discord.
        </p>
      </div>
      <UserFilmsCount />
      <h3 className="subheading">How we rated all of our movies:</h3>
      <div className="flex mb-4 justify-center">
        {loading ? (
          <Spinner />
        ) : (
          <RatingDistributionHistogram size="md" distribution={allRatings} />
        )}
      </div>
      <div className="flex flex-row justify-between max-md:justify-center max-md:flex-col m-auto w-[100%]">
        <div className="flex-1 mr-2">
          <h3 className="subheading">Our highest rated movies (20+ ratings)</h3>
          <MovieList movies={topRatedUserFilms} showRating={true} size="sm" />
        </div>

        <div className="flex-1 ml-2">
          <h3 className="subheading">Our most watched movies</h3>
          <MovieList size="sm" movies={topWatchedFilms} showCount={true} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
