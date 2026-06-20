import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { apiService } from "../services/api";
import type { FilmUserComplete, UserFilm } from "../types";
import RatingDistributionHistogram from "./RatingDistributionHistogram";
import CompatibilityExtremes from "./CompatibilityExtremes";
import NotFound from "./NotFound";

const TOP_FILMS_LIMIT = 12;

const formatStars = (rating: number): string => {
  const full = Math.floor(rating);
  const half = rating % 1 !== 0;
  return "★".repeat(full) + (half ? "½" : "");
};

const TopRatedFilms = ({ films }: { films: UserFilm[] }) => {
  const top = [...films]
    .filter((f) => f.rating > 0)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, TOP_FILMS_LIMIT);

  if (top.length === 0) return null;

  return (
    <div className="card">
      <h4 className="text-xl font-semibold text-letterboxd-text-primary mb-4">
        Top rated films
      </h4>
      <ul className="divide-y divide-letterboxd-border">
        {top.map((film) => (
          <li
            key={film.film_slug}
            className="flex items-baseline justify-between gap-3 py-1"
          >
            <a
              href={`https://letterboxd.com/film/${film.film_slug}`}
              target="_blank"
              rel="noreferrer"
              className="text-letterboxd-text-primary hover:text-letterboxd-accent truncate"
            >
              {film.title || film.film_slug}
            </a>
            <span className="text-letterboxd-pro text-sm whitespace-nowrap">
              {formatStars(film.rating)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const UserProfile = () => {
  const { username = "" } = useParams();
  const [profile, setProfile] = useState<FilmUserComplete | null>(null);
  const [films, setFilms] = useState<UserFilm[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!username) return;

    const ac = new AbortController();
    setLoading(true);
    setNotFound(false);
    setProfile(null);
    setFilms([]);

    async function fetchProfile() {
      try {
        const completeRes = await apiService.getFilmUserComplete(username);
        if (ac.signal.aborted) return;
        if (!completeRes.data) {
          setNotFound(true);
          return;
        }
        setProfile(completeRes.data as FilmUserComplete);

        // Films power the top-rated widget. A failure here shouldn't sink the
        // whole page — degrade to no top-rated section.
        try {
          const filmsRes = await apiService.getFilmUserFilms(
            username,
            ac.signal,
          );
          if (filmsRes.data) setFilms(filmsRes.data);
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") return;
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setNotFound(true);
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }

    fetchProfile();

    return () => ac.abort();
  }, [username]);

  if (loading) {
    return (
      <div className="card text-letterboxd-text-muted text-sm">
        Loading profile…
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <NotFound
        title={`No profile for "${username}"`}
        message="We don't have Letterboxd data for this user yet. They may need to be added and refreshed."
      />
    );
  }

  const displayName = profile.displayName || profile.username;

  return (
    <div className="space-y-8">
      <div className="card">
        <h2 className="text-3xl font-bold text-letterboxd-text-primary">
          {displayName}
        </h2>
        <a
          href={`https://letterboxd.com/${profile.username}`}
          target="_blank"
          rel="noreferrer"
          className="text-letterboxd-text-secondary hover:text-letterboxd-accent"
        >
          @{profile.username}
        </a>
        <p className="text-sm text-letterboxd-text-muted mt-2">
          {profile.totalRatings.toLocaleString()} ratings
        </p>
      </div>

      <div className="card">
        <h4 className="text-xl font-semibold text-letterboxd-text-primary mb-4">
          Rating distribution
        </h4>
        <RatingDistributionHistogram distribution={profile.ratings} size="md" />
      </div>

      <CompatibilityExtremes username={profile.username} />

      <TopRatedFilms films={films} />
    </div>
  );
};

export default UserProfile;
