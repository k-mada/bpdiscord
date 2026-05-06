import { useEffect, useRef, useState } from "react";
import { apiService } from "../services/api";
import {
  ActorPath,
  ActorPathStep,
} from "../hooks/useActorGraph";
import Spinner from "./Spinner";

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w185";

const PLACEHOLDER_ACTOR =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 150'><rect width='100' height='150' fill='%232a2d2f'/><circle cx='50' cy='55' r='20' fill='%23505050'/><path d='M20 130 Q50 90 80 130 Z' fill='%23505050'/></svg>";

const PLACEHOLDER_MOVIE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 150'><rect width='100' height='150' fill='%232a2d2f'/><text x='50' y='80' text-anchor='middle' font-family='sans-serif' font-size='14' fill='%23808080'>No Image</text></svg>";

const buildImageUrl = (path: string | null | undefined): string | null =>
  path ? `${TMDB_IMAGE_BASE}${path}` : null;

interface ActorOption {
  tmdbId: number;
  name: string;
  profilePath: string | null;
}

// Shape returned by /api/actor-graph/search — we only consume the `actors` array.
interface SearchActorRow {
  tmdbId: number;
  name: string;
  profilePath: string | null;
  popularity: number | null;
  type: "actor";
  inDatabase: boolean;
}

interface SearchResponseData {
  actors?: SearchActorRow[];
  movies?: unknown[];
}

interface ActorComboBoxProps {
  label: string;
  selected: ActorOption | null;
  onSelect: (actor: ActorOption | null) => void;
  excludeId?: number;
}

const ActorComboBox = ({
  label,
  selected,
  onSelect,
  excludeId,
}: ActorComboBoxProps) => {
  const [query, setQuery] = useState(selected?.name ?? "");
  const [results, setResults] = useState<ActorOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setQuery(selected?.name ?? "");
  }, [selected?.tmdbId, selected?.name]);

  // Debounced search — fires 200ms after the user stops typing.
  useEffect(() => {
    const trimmed = query.trim();
    if (!open) return;
    // The /search endpoint requires q to be at least 2 chars.
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    if (selected && trimmed === selected.name) {
      // Don't refetch when the input still shows the chosen actor's name.
      return;
    }

    setLoading(true);
    setError(null);
    const handle = window.setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const response = await apiService.searchGraph(
          trimmed,
          controller.signal
        );
        if (controller.signal.aborted) return;
        const data = response.data as SearchResponseData | undefined;
        const actors: ActorOption[] = (data?.actors ?? []).map((a) => ({
          tmdbId: a.tmdbId,
          name: a.name,
          profilePath: a.profilePath,
        }));
        setResults(actors);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Search failed");
        setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);

    return () => {
      window.clearTimeout(handle);
    };
  }, [query, open, selected]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSelect = (actor: ActorOption) => {
    onSelect(actor);
    setQuery(actor.name);
    setOpen(false);
  };

  const handleClear = () => {
    onSelect(null);
    setQuery("");
    setResults([]);
    setOpen(true);
  };

  const filteredResults = excludeId
    ? results.filter((r) => r.tmdbId !== excludeId)
    : results;

  return (
    <div ref={containerRef} className="relative w-full">
      <label className="block text-sm text-letterboxd-text-secondary mb-2">
        {label}
      </label>
      <div className="relative">
        <input
          type="text"
          className="input-field w-full pr-9"
          placeholder="Type an actor's name..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (selected) onSelect(null);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          aria-autocomplete="list"
          aria-expanded={open}
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-letterboxd-text-muted hover:text-letterboxd-text-primary px-2"
          >
            ×
          </button>
        )}
      </div>

      {open && (query.trim().length > 0 || loading) && (
        <div className="absolute left-0 right-0 z-10 mt-1 bg-letterboxd-bg-secondary border border-letterboxd-border rounded-lg shadow-letterboxd-lg max-h-80 overflow-y-auto">
          {loading && (
            <div className="px-4 py-3 text-sm text-letterboxd-text-secondary">
              Searching…
            </div>
          )}
          {!loading && error && (
            <div className="px-4 py-3 text-sm text-red-400">{error}</div>
          )}
          {!loading && !error && filteredResults.length === 0 && (
            <div className="px-4 py-3 text-sm text-letterboxd-text-secondary">
              {query.trim().length < 2 ? "Type at least 2 characters" : "No matches"}
            </div>
          )}
          {!loading &&
            !error &&
            filteredResults.map((actor) => (
              <button
                key={actor.tmdbId}
                type="button"
                onClick={() => handleSelect(actor)}
                className="flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-letterboxd-bg-tertiary transition-colors"
              >
                <img
                  src={buildImageUrl(actor.profilePath) || PLACEHOLDER_ACTOR}
                  alt=""
                  className="w-10 h-14 object-cover rounded"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      PLACEHOLDER_ACTOR;
                  }}
                />
                <span className="text-letterboxd-text-primary">
                  {actor.name}
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
};

interface PathNodeCardProps {
  step: ActorPathStep;
}

const PathNodeCard = ({ step }: PathNodeCardProps) => {
  const isActor = step.kind === "actor";
  const fallback = isActor ? PLACEHOLDER_ACTOR : PLACEHOLDER_MOVIE;
  const imageUrl = isActor
    ? buildImageUrl(step.profilePath)
    : buildImageUrl(step.posterPath);
  const name = isActor ? step.name : step.title;
  const label = isActor ? "actor" : "movie";

  return (
    <div className="flex flex-col items-center w-[110px] shrink-0">
      <div className="w-[110px] h-[165px] rounded-md overflow-hidden bg-letterboxd-bg-secondary border border-letterboxd-border">
        <img
          src={imageUrl || fallback}
          alt={name}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = fallback;
          }}
        />
      </div>
      <div className="mt-2 text-center text-xs text-letterboxd-text-primary leading-tight line-clamp-2 w-full">
        {name}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-letterboxd-text-muted">
        {label}
      </div>
    </div>
  );
};

const PathArrow = () => (
  <div className="flex items-center justify-center h-[165px] text-letterboxd-text-muted text-2xl shrink-0 px-1">
    →
  </div>
);

interface PathDisplayProps {
  path: ActorPathStep[];
}

const PathDisplay = ({ path }: PathDisplayProps) => {
  return (
    <div className="flex flex-wrap items-start gap-y-6 gap-x-1">
      {path.map((step, idx) => (
        <div
          key={`${step.kind}-${step.tmdbId}-${idx}`}
          className="flex items-start"
        >
          <PathNodeCard step={step} />
          {idx < path.length - 1 && <PathArrow />}
        </div>
      ))}
    </div>
  );
};

const ActorGraph = () => {
  const [actor1, setActor1] = useState<ActorOption | null>(null);
  const [actor2, setActor2] = useState<ActorOption | null>(null);
  const [pathData, setPathData] = useState<ActorPath | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!actor1 || !actor2) {
      setPathData(null);
      setError(null);
      return;
    }
    if (actor1.tmdbId === actor2.tmdbId) {
      setPathData(null);
      setError("Pick two different actors.");
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setPathData(null);

    apiService
      .pathFinder(String(actor1.tmdbId), String(actor2.tmdbId), controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        const data = response.data as ActorPath | undefined;
        setPathData(data ?? null);
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        setError(err.message || "Failed to find path");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [actor1, actor2]);

  return (
    <div>
      <h1 className="text-3xl font-bold text-letterboxd-text-primary mb-6">
        Actor Graph
      </h1>
      <p className="text-letterboxd-text-secondary mb-6">
        Select two actors to see how they connect through the movies they've
        been in.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <ActorComboBox
          label="Actor 1"
          selected={actor1}
          onSelect={setActor1}
          {...(actor2 ? { excludeId: actor2.tmdbId } : {})}
        />
        <ActorComboBox
          label="Actor 2"
          selected={actor2}
          onSelect={setActor2}
          {...(actor1 ? { excludeId: actor1.tmdbId } : {})}
        />
      </div>

      {loading && <Spinner />}

      {!loading && error && (
        <div className="bg-letterboxd-bg-secondary border border-red-500/40 text-red-300 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {!loading && !error && pathData && pathData.path.length > 0 && (
        <div>
          <h2 className="subheading">
            Path
            <span className="ml-2 text-sm font-normal text-letterboxd-text-secondary">
              {pathData.degrees}{" "}
              {pathData.degrees === 1 ? "degree" : "degrees"} of separation
            </span>
          </h2>
          <PathDisplay path={pathData.path} />
        </div>
      )}
    </div>
  );
};

export default ActorGraph;
