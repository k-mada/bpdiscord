import { useState } from "react";
import { useComparison } from "../hooks/useComparison";
import { useMoviesInCommon } from "../hooks/useMoviesInCommon";
import TasteCompatibility, {
  TasteCompatibilitySkeleton,
} from "./TasteCompatibility";

interface CompareWithUserProps {
  baseUsername: string;
  baseDisplayName?: string | undefined;
}

// Profile-page widget: pick one other user and see how this profile's taste
// compares to theirs (the same compatibility meter + anchor films as the
// /compare page, but with the base user fixed and a single dropdown).
const CompareWithUser = ({
  baseUsername,
  baseDisplayName,
}: CompareWithUserProps) => {
  const { usernames } = useComparison();
  const [selected, setSelected] = useState("");
  const { data, loading, error } = useMoviesInCommon(
    baseUsername,
    selected || null,
  );

  const candidates = usernames.filter((u) => u.username !== baseUsername);
  const selectedDisplayName = usernames.find(
    (u) => u.username === selected,
  )?.displayName;

  return (
    <div className="space-y-4">
      <div className="card">
        <h4 className="text-xl font-semibold text-letterboxd-text-primary mb-3">
          Compare taste with…
        </h4>
        <div className="select-wrapper">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="input-field w-full"
          >
            <option value="">Select a user</option>
            {candidates.map((u) => (
              <option key={u.username} value={u.username}>
                {u.displayName || u.username}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="card text-red-400 text-sm">{error}</div>
      )}

      {loading && <TasteCompatibilitySkeleton />}

      {!loading && data && data.moviesInCommon.length === 0 && (
        <div className="card text-letterboxd-text-muted text-sm text-center">
          No films in common with{" "}
          {selectedDisplayName || selected} yet.
        </div>
      )}

      {!loading && data && data.moviesInCommon.length > 0 && (
        <TasteCompatibility
          user1Data={{
            username: baseUsername,
            ...(baseDisplayName ? { displayName: baseDisplayName } : {}),
          }}
          user2Data={{
            username: selected,
            ...(selectedDisplayName ? { displayName: selectedDisplayName } : {}),
          }}
          moviesInCommon={data.moviesInCommon}
        />
      )}
    </div>
  );
};

export default CompareWithUser;
