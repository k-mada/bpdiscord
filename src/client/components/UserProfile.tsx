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
      <div className="card flex justify-start md:justify-between flex-col md:flex-row items-center">
        <div>
          <h2 className="text-xl md:text-3xl font-bold text-letterboxd-text-primary">
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
        </div>
        <RatingDistributionHistogram
          distribution={profile.ratings}
          size="sm"
          className="ml-10"
        />

        <div className="flex mt-4 md:mt-0 ml-0 md:ml-auto items-center">
          <div className="pr-10 border-r-2 border-gray-700 text-center">
            <span className="block text-2xl text-letterboxd-text-primary">
              {profile.totalWatched.toLocaleString()}
            </span>
            <span className="block text-letterboxd-text-muted text-md">
              watched
            </span>
          </div>
          <div className="pl-10 text-center">
            <span className="block text-2xl text-letterboxd-text-primary">
              {profile.totalRatings.toLocaleString()}
            </span>
            <span className="block text-letterboxd-text-muted text-md">
              rated
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <CompatibilityExtremes username={profile.username} />
        <CompareWithUser
          baseUsername={profile.username}
          baseDisplayName={profile.displayName ?? undefined}
        />
      </div>
    </div>
  );
};

export default UserProfile;
