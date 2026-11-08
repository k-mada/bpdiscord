import Card from "./Card";
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
    <Card className="text-center py-16">
      <h2 className="type-h1-lg text-letterboxd-text-primary mb-3">
        {title}
      </h2>
      <p className="text-letterboxd-text-secondary mb-6">{message}</p>
      <Link
        to="/"
        className="text-letterboxd-accent hover:text-letterboxd-accent-hover type-strong"
      >
        ← Back to home
      </Link>
    </Card>
  );
};

export default NotFound;
