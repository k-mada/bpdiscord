import { useUserFilmsCount } from "../hooks/useUserFilmsCount";
import Spinner from "./Spinner";

const UserFilmsCount = () => {
  const { data, loading, error } = useUserFilmsCount();

  return (
    <div className="movie-counter">
      <h3>Movies watched by this Discord:</h3>
      {loading ? (
        <Spinner size="sm" />
      ) : error ? (
        <p className="text-red-500" role="alert">
          {error}
        </p>
      ) : (
        <span data-testid="user-films-count" className="ml-5 text-3xl font-bold">
          {data}
        </span>
      )}
    </div>
  );
};

export default UserFilmsCount;
