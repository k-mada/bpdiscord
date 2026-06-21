import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { apiService } from "../services/api";
import type { FilmUserComplete } from "../types";
import RatingDistributionHistogram from "./RatingDistributionHistogram";
import CompatibilityExtremes from "./CompatibilityExtremes";
import CompareWithUser from "./CompareWithUser";
import NotFound from "./NotFound";

const UserProfile = () => {
  const { username = "" } = useParams();
  const [profile, setProfile] = useState<FilmUserComplete | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!username) return;

    const ac = new AbortController();
    setLoading(true);
    setNotFound(false);
    setProfile(null);

    async function fetchProfile() {
      try {
        const completeRes = await apiService.getFilmUserComplete(username);
        if (ac.signal.aborted) return;
        if (!completeRes.data) {
          setNotFound(true);
          return;
        }
        setProfile(completeRes.data as FilmUserComplete);
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
          Letterboxd: @{profile.username}
        </a>
        <p className="text-sm text-letterboxd-text-muted mt-2">
          {profile.totalRatings.toLocaleString()} ratings
        </p>
        <div>
          <RatingDistributionHistogram
            distribution={profile.ratings}
            size="sm"
            className="justify-center"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="card">
          <h4 className="text-xl font-semibold text-letterboxd-text-primary mb-4">
            Rating distribution
          </h4>

          <RatingDistributionHistogram
            distribution={profile.ratings}
            size="sm"
            className="justify-center"
          />
        </div>

        <CompatibilityExtremes username={profile.username} />
      </div>

      <CompareWithUser
        baseUsername={profile.username}
        baseDisplayName={profile.displayName ?? undefined}
      />
    </div>
  );
};

export default UserProfile;
