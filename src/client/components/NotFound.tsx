import { Link } from "react-router-dom";

interface NotFoundProps {
  title?: string;
  message?: string;
}

const NotFound = ({
  title = "Page not found",
  message = "The page you're looking for doesn't exist.",
}: NotFoundProps) => {
  return (
    <div className="card text-center py-16">
      <h2 className="text-3xl font-bold text-letterboxd-text-primary mb-3">
        {title}
      </h2>
      <p className="text-letterboxd-text-secondary mb-6">{message}</p>
      <Link
        to="/"
        className="text-letterboxd-accent hover:text-letterboxd-accent-hover font-medium"
      >
        ← Back to home
      </Link>
    </div>
  );
};

export default NotFound;
