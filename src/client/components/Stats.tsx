import ContentWrapper from "./ContentWrapper";
import { moviesData } from "../constants";

const Dashboard = () => {
  const topMoviesWatched = moviesData
    .sort((a, b) => b.usersWatched - a.usersWatched)
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
        <span className="text-3xl font-bold">
          Number of movies watched by this Discord:
        </span>
        <span className="text-3xl font-bold movie-count"></span>
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
