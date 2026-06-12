import {
  formatSignedPercent,
  getPearsonLabel,
} from "../lib/ratingsCompatibility";
import { useCompatibilityExtremes } from "../hooks/useCompatibilityExtremes";
import type { CompatibilityExtreme } from "../types";

interface Props {
  username: string;
}

const Row = ({ row }: { row: CompatibilityExtreme }) => (
  <li className="flex items-baseline justify-between gap-3 py-1">
    <a
      href={`/user/${row.username}`}
      className="text-letterboxd-text-primary hover:text-letterboxd-accent truncate"
    >
      {row.displayName || row.username}
    </a>
    <span className="text-sm tabular-nums whitespace-nowrap">
      <span className="text-letterboxd-text-primary font-semibold">
        {formatSignedPercent(row.pearson)}
      </span>{" "}
      <span className="text-letterboxd-text-muted">
        ({getPearsonLabel(row.pearson)})
      </span>
    </span>
  </li>
);

const CompatibilityExtremes = ({ username }: Props) => {
  const { data, loading, error } = useCompatibilityExtremes(username);

  if (loading) {
    return (
      <div className="card text-letterboxd-text-muted text-sm">
        Loading compatibility…
      </div>
    );
  }
  if (error) {
    return <div className="card text-red-400 text-sm">{error}</div>;
  }

  const most = data?.mostCompatible ?? [];
  const least = data?.leastCompatible ?? [];

  if (most.length === 0 && least.length === 0) {
    return (
      <div className="card text-letterboxd-text-muted text-sm text-center">
        Not enough compatibility data yet.
      </div>
    );
  }

  return (
    <div className="card">
      <h4 className="text-xl font-semibold text-letterboxd-text-primary mb-4 flex items-center gap-2">
        🎯 Compatibility
      </h4>

      {most.length > 0 && (
        <section className="mb-4">
          <h5 className="text-sm font-medium text-letterboxd-text-secondary mb-2">
            People you are most compatible with
          </h5>
          <ul className="divide-y divide-letterboxd-border">
            {most.map((r) => (
              <Row key={r.username} row={r} />
            ))}
          </ul>
        </section>
      )}

      {least.length > 0 && (
        <section>
          <h5 className="text-sm font-medium text-letterboxd-text-secondary mb-2">
            People you are least compatible with
          </h5>
          <ul className="divide-y divide-letterboxd-border">
            {least.map((r) => (
              <Row key={r.username} row={r} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default CompatibilityExtremes;
