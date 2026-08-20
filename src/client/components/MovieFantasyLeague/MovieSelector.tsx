import { useId } from "react";

const MovieSelector = ({
  onMovieSelect,
  movies,
}: {
  movies: { title: string; filmSlug: string }[];
  onMovieSelect: (filmSlug: string) => void;
}) => {
  const selectId = useId();

  function handleMovieSelect(event: React.ChangeEvent<HTMLSelectElement>) {
    const filmSlug = event.target.value;
    onMovieSelect(filmSlug);
  }

  return (
    <>
      <label htmlFor={selectId} className="sr-only">
        Select a movie
      </label>
      <select
        id={selectId}
        className="input-field w-1/2"
        onChange={handleMovieSelect}
      >
        <option value="-1">Select a movie</option>
        {movies.map((movie) => {
          return (
            <option key={movie.filmSlug} value={movie.filmSlug}>
              {movie.title}
            </option>
          );
        })}
      </select>
    </>
  );
};

export default MovieSelector;
