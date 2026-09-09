import { Link } from "react-router-dom";
import type { RatingDeviationFilm } from "../../shared/types";
import { cn } from "../lib/utils";

type RatingDeviationsProps = {
  over: RatingDeviationFilm[];
  under: RatingDeviationFilm[];
  loading?: boolean;
};

const NO_DATA = "Not enough ratings this year to compare.";
const NO_OVER = "No film averaged above its Letterboxd rating.";
const NO_UNDER = "No film averaged below its Letterboxd rating.";

const COLUMN_LABEL = {
  over: "Films rated above their Letterboxd average",
  under: "Films rated below their Letterboxd average",
} as const;

const formatDeviation = (d: number) => `${d >= 0 ? "+" : ""}${d.toFixed(2)}`;

const cardBase =
  "rounded-xl border border-letterboxd-border bg-letterboxd-bg-secondary p-4 shadow-sm";

const MessageCard = ({ text }: { text: string }) => (
  <div className={cn(cardBase, "text-sm italic text-letterboxd-text-secondary")}>
    {text}
  </div>
);

const Card = ({
  film,
  tone,
}: {
  film: RatingDeviationFilm;
  tone: "over" | "under";
}) => (
  <Link
    to={`/film/${film.film_slug}`}
    className={cn(
      cardBase,
      "group flex items-center justify-between gap-4 transition-colors hover:border-letterboxd-border-light",
    )}
  >
    <div className="min-w-0">
      <span className="block truncate font-bold text-letterboxd-text-primary transition-colors group-hover:text-letterboxd-link-hover">
        {film.title}
      </span>
      <span className="block text-sm text-letterboxd-text-secondary">
        Ours {film.average_rating.toFixed(2)} · LB {film.lb_rating.toFixed(2)}
      </span>
    </div>
    <span
      className={cn(
        "shrink-0 whitespace-nowrap text-2xl font-bold",
        tone === "over"
          ? "text-letterboxd-success"
          : "text-letterboxd-error",
      )}
    >
      {formatDeviation(film.deviation)}
    </span>
  </Link>
);

const Column = ({
  films,
  tone,
}: {
  films: RatingDeviationFilm[];
  tone: "over" | "under";
}) => (
  // The server already scopes each side by sign, so an empty column means there
  // were no films deviating in this direction.
  <div
    role="group"
    aria-label={COLUMN_LABEL[tone]}
    className="flex-1 min-w-0 flex flex-col gap-3"
  >
    {films.length === 0 ? (
      <MessageCard text={tone === "over" ? NO_OVER : NO_UNDER} />
    ) : (
      films.map((film) => <Card key={film.film_slug} film={film} tone={tone} />)
    )}
  </div>
);

const RatingDeviations = ({
  over,
  under,
  loading = false,
}: RatingDeviationsProps) => {
  const noData = over.length === 0 && under.length === 0;

  return (
    <div
      aria-busy={loading}
      className={cn(
        "flex flex-row max-md:flex-col gap-4 w-full transition-opacity",
        loading && "opacity-50",
      )}
    >
      {noData ? (
        <MessageCard text={NO_DATA} />
      ) : (
        <>
          <Column films={over} tone="over" />
          <Column films={under} tone="under" />
        </>
      )}
    </div>
  );
};

export default RatingDeviations;
