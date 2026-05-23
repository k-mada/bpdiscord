import { useState, useEffect } from "react";
import apiService from "../services/api";
import RatingDistributionHistogram from "./RatingDistributionHistogram";
import UserFilmsCount from "./UserFilmsCount";
import type { LBFilm } from "../types";

const Dashboard = () => {
  const [topWatchedFilms, setTopWatchedFilms] = useState<LBFilm[]>([]);
  const [topRatedUserFilms, setTopRatedUserFilms] = useState<LBFilm[]>([]);

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
      console.log("topRatedUserFilms", topRatedUserFilms.data);
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

      <h3 className="subheading">How we rated of our movies:</h3>
      <div className="flex mb-4 justify-center">
        <RatingDistributionHistogram size="md" />
      </div>
      <h3 className="subheading">Most watched movies</h3>
      <ul className="film-list-small movie-poster-fade-in">
        {topWatchedFilms.map((movie, index: number) => (
          <li
            key={movie.film_slug}
            style={{ animationDelay: `${index * 0.2 + 0.5}s` }}
          >
            <div>
              <img
                src={movie.poster?.replace("0-230-0-345", "0-70-0-105") ?? ""}
                alt={movie.title ?? ""}
              />
            </div>
          </li>
        ))}
      </ul>
      <h3 className="subheading">Highest rated movies (20+ ratings)</h3>

      <ul className="film-list movie-poster-fade-in">
        {topRatedUserFilms.map((movie, index) => (
          <li
            key={movie.film_slug}
            style={{ animationDelay: `${index * 0.3 + 0.5}s` }}
          >
            <div>
              <img src={movie.poster ?? ""} alt={movie.title ?? ""} />
              <span className="rating-overlay">
                ★{movie.average_rating ?? 0}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Dashboard;
