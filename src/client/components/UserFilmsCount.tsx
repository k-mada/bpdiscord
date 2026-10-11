import { useUserFilmsCount } from "../hooks/useUserFilmsCount";
import Spinner from "./Spinner";

const UserFilmsCount = ({ year = null }: { year?: number | null }) => {
  const { data, error } = useUserFilmsCount(year);

  const heading =
    year === null
      ? "Movies watched by this Discord:"
      : `Movies from ${year} watched by this Discord:`;

  return (
    <div className="movie-counter text-4xl">
      <h2>{heading}</h2>
      {error ? (
        <p className="text-letterboxd-error" role="status">
          {error}
        </p>
      ) : data === null ? (
        <Spinner size="sm" />
      ) : (
        <span data-testid="user-films-count" className="ml-5 font-bold">
          {data}
        </span>
      )}
    </div>
  );
};

export default UserFilmsCount;
