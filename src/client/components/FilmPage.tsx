import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useFilmDetail } from "../hooks/useFilmDetail";
import { posterAtWidth } from "../lib/poster";
import StarRating from "./StarRating";
import NotFound from "./NotFound";
import type { FilmRater } from "../../shared/types";

const POSTER_WIDTH = 320;

const StatTile = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col-reverse text-center">
    <dt className="text-letterboxd-text-muted text-sm">{label}</dt>
    <dd className="text-2xl text-letterboxd-text-primary tabular-nums">
      {value}
    </dd>
  </div>
);

const RaterRow = ({ rater }: { rater: FilmRater }) => (
  <li className="flex items-center justify-between gap-3 py-2 border-b border-letterboxd-border">
    <Link
      to={`/user/${rater.username}`}
      className="text-letterboxd-text-primary hover:text-letterboxd-accent truncate"
    >
      {rater.displayName || rater.username}
    </Link>
    <span className="flex items-center gap-2 shrink-0">
      {rater.liked && (
        <span role="img" aria-label="liked" className="text-letterboxd-accent">
          ♥
        </span>
      )}
      <StarRating rating={rater.rating} />
      <span className="text-sm tabular-nums text-letterboxd-text-secondary">
        {rater.rating.toFixed(1)}
      </span>
    </span>
  </li>
);

const FilmPage = () => {
  const { filmSlug = "" } = useParams();
  const [searchParams] = useSearchParams();
  const includeNonDiscord = searchParams.get("includeNonDiscord") === "true";
  const { data, loading, error, notFound } = useFilmDetail(
    filmSlug,
    includeNonDiscord,
  );
  // Keyed by URL, not a boolean: one film's missing crop must not disable
  // upscaling for every film visited afterwards.
  const [failedPoster, setFailedPoster] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="card text-letterboxd-text-muted text-sm" aria-busy="true">
        Loading film…
      </div>
    );
  }

  if (notFound) {
    return (
      <NotFound
        title={`No film for "${filmSlug}"`}
        message="We don't have Letterboxd data for this film yet. It may need to be added and refreshed."
      />
    );
  }

  if (error || !data) {
    return (
      <div className="card text-red-400 text-sm">
        {error ?? "Failed to load film"}
      </div>
    );
  }

  const letterboxdUrl =
    data.letterboxdUrl ?? `https://letterboxd.com/film/${data.filmSlug}/`;
  // Falls back to the stored (smaller) poster if a resized crop doesn't exist.
  const upscale = data.poster && failedPoster !== data.poster;
  const posterSrc = upscale
    ? posterAtWidth(data.poster!, POSTER_WIDTH)
    : data.poster;
  const posterSrcSet = upscale
    ? `${posterAtWidth(data.poster!, 460)} 460w, ${posterAtWidth(data.poster!, 600)} 600w`
    : undefined;

  const emptyRatings =
    data.watchedCount === 0
      ? "Nobody in the Discord has logged this film yet."
      : `No ratings yet — ${data.watchedCount} ${
          data.watchedCount === 1 ? "person has" : "people have"
        } logged it.`;

  return (
    <div className="space-y-8">
      <div className="card flex flex-col md:flex-row items-center md:items-start gap-6">
        <a
          href={letterboxdUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`View ${data.title} on Letterboxd`}
          className="block w-full max-w-[320px] shrink-0 transition-transform duration-300 hover:scale-[1.02]"
        >
          {posterSrc ? (
            <img
              src={posterSrc}
              srcSet={posterSrcSet}
              sizes={`${POSTER_WIDTH}px`}
              alt={`${data.title} poster`}
              width={POSTER_WIDTH}
              height={POSTER_WIDTH * 1.5}
              onError={() => setFailedPoster(data.poster)}
              className="w-full aspect-[2/3] object-cover rounded"
            />
          ) : (
            <div className="flex w-full aspect-[2/3] items-center justify-center rounded bg-letterboxd-bg-tertiary text-sm text-letterboxd-text-muted">
              No poster
            </div>
          )}
        </a>

        <div className="w-full min-w-0 flex-1">
          <h1 className="text-2xl md:text-4xl font-bold text-letterboxd-text-primary">
            {data.title}
          </h1>
          {data.releaseYear && (
            <p className="text-letterboxd-text-secondary mt-1">
              {data.releaseYear}
            </p>
          )}
          <a
            href={letterboxdUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-2 text-letterboxd-text-secondary hover:text-letterboxd-accent"
          >
            View on Letterboxd ↗
          </a>

          <dl className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatTile
              label="watched"
              value={data.watchedCount.toLocaleString()}
            />
            <StatTile label="rated" value={data.ratedCount.toLocaleString()} />
            <StatTile
              label="our average"
              value={data.averageRating?.toFixed(2) ?? "—"}
            />
            <StatTile
              label="Letterboxd average"
              value={data.letterboxdRating?.toFixed(2) ?? "—"}
            />
          </dl>
        </div>
      </div>

      <div className="card">
        <h2 className="subheading">How we rated it</h2>
        {data.ratings.length > 0 ? (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
            {data.ratings.map((rater) => (
              <RaterRow key={rater.username} rater={rater} />
            ))}
          </ul>
        ) : (
          <p className="body-text -prose italic opacity-70">{emptyRatings}</p>
        )}
      </div>
    </div>
  );
};

export default FilmPage;
