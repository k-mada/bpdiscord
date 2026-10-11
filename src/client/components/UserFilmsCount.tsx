import { useUserFilmsCount } from "../hooks/useUserFilmsCount";
import Spinner from "./Spinner";

const UserFilmsCount = () => {
  const { data, loading, error } = useUserFilmsCount();

  return (
    <div className="movie-counter text-4xl">
      <h2>Movies watched by this Discord:</h2>
      {loading ? (
        <Spinner size="sm" />
      ) : error ? (
        <p className="text-letterboxd-error" role="status">
          {error}
        </p>
      ) : (
        <span data-testid="user-films-count" className="ml-5 font-bold">
          {data}
        </span>
      )}
    </div>
  );
};

export default UserFilmsCount;
