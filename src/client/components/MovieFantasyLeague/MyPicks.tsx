import { useEffect, useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Spinner from "../Spinner";
import { Notification, Status } from "../ui/Notification";
import { useMflData } from "../../hooks/useMflData";
import { useAuth } from "../../contexts/AuthContext";
import apiService from "../../services/api";
import { failureMessage } from "../../lib/failureMessage";
import { MFLCatalogueFilm } from "../../types";

// Vulture's rules, mirrored here only. The server validates data integrity, not
// roster size or spend, so a rule change there does not need a deploy here.
const ROSTER_SIZE = 8;
const BUDGET = 100;
const EMPTY = "";

const priceOf = (film: MFLCatalogueFilm | undefined) => film?.price ?? 0;

interface SlotProps {
  index: number;
  slug: string;
  film: MFLCatalogueFilm | undefined;
  options: MFLCatalogueFilm[];
  takenElsewhere: Set<string>;
  disabled: boolean;
  onSelect: (index: number, slug: string) => void;
  onClear: (index: number) => void;
}

const Slot = ({
  index,
  slug,
  film,
  options,
  takenElsewhere,
  disabled,
  onSelect,
  onClear,
}: SlotProps) => {
  const selectId = useId();

  return (
    <li className="flex items-center gap-2 sm:gap-3 rounded-lg border border-letterboxd-border-light bg-letterboxd-bg-secondary px-3 sm:px-4">
      <label htmlFor={selectId} className="sr-only">
        Movie {index + 1}
      </label>
      <select
        id={selectId}
        value={slug}
        disabled={disabled}
        onChange={(event) => onSelect(index, event.target.value)}
        className="min-w-0 flex-1 bg-transparent py-3 text-letterboxd-text-primary disabled:opacity-50"
      >
        <option value={EMPTY}>Select movie</option>
        {/* Every film stays listed. Hiding the taken ones made the catalogue
            look short with no way to tell what was missing. */}
        {options.map((option) => {
          const taken = takenElsewhere.has(option.filmSlug);
          return (
            <option
              key={option.filmSlug}
              value={option.filmSlug}
              disabled={taken}
            >
              {option.title} (${option.price ?? 0})
              {taken ? " — already picked" : ""}
            </option>
          );
        })}
      </select>

      <span className="shrink-0 tabular-nums font-medium text-letterboxd-text-primary">
        ${priceOf(film)}
      </span>

      {/* Fixed size, not padding: an icon-only control still needs a
          comfortable touch target on a phone. */}
      <button
        type="button"
        aria-label={film ? `Remove ${film.title}` : `Clear movie ${index + 1}`}
        disabled={disabled || !film}
        onClick={() => onClear(index)}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-letterboxd-text-secondary hover:text-letterboxd-text-primary disabled:invisible"
      >
        <span aria-hidden="true" className="text-lg leading-none">
          ✕
        </span>
      </button>
    </li>
  );
};

const MyPicks = () => {
  const { token, user, loading: authLoading } = useAuth();
  const { movies, loading: catalogueLoading } = useMflData();
  const [slots, setSlots] = useState<string[]>(() =>
    Array<string>(ROSTER_SIZE).fill(EMPTY),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>({ type: "idle" });

  const isLinked = Boolean(user?.lbusername);

  useEffect(() => {
    // Judging isLinked before /me resolves would flash eight empty slots at a
    // member who already has a roster.
    if (authLoading) return;
    if (!token || !isLinked) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();

    async function loadPicks(authToken: string) {
      try {
        const response = await apiService.getMflPicks(
          authToken,
          controller.signal,
        );
        const saved = (response.data ?? []).map((pick) => pick.filmSlug);
        setSlots(
          Array.from({ length: ROSTER_SIZE }, (_, i) => saved[i] ?? EMPTY),
        );
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        setStatus({ type: "error", message: failureMessage(error) });
      } finally {
        setLoading(false);
      }
    }

    loadPicks(token);
    return () => controller.abort();
  }, [authLoading, token, isLinked]);

  const bySlug = useMemo(
    () => new Map(movies.map((movie) => [movie.filmSlug, movie])),
    [movies],
  );

  // Vulture lists films most expensive first; matching that keeps the two
  // readable side by side while drafting. Title breaks ties.
  const byPrice = useMemo(
    () =>
      [...movies].sort(
        (a, b) =>
          (b.price ?? 0) - (a.price ?? 0) || a.title.localeCompare(b.title),
      ),
    [movies],
  );

  const filled = slots.filter((slug) => slug !== EMPTY);
  const totalSpend = filled.reduce(
    (total, slug) => total + priceOf(bySlug.get(slug)),
    0,
  );
  const overBudget = totalSpend > BUDGET;
  const complete = filled.length === ROSTER_SIZE;

  // Listed but not selectable, so a duplicate stays impossible without the
  // catalogue appearing to be missing films.
  const takenElsewhere = (index: number) =>
    new Set(slots.filter((slug, i) => i !== index && slug !== EMPTY));

  const handleSelect = (index: number, slug: string) => {
    setStatus({ type: "idle" });
    setSlots((prev) => prev.map((cur, i) => (i === index ? slug : cur)));
  };

  const handleClear = (index: number) => {
    setStatus({ type: "idle" });
    setSlots((prev) => prev.map((cur, i) => (i === index ? EMPTY : cur)));
  };

  const handleSubmit = async () => {
    if (!token || !complete || overBudget) return;
    setStatus({ type: "idle" });
    setSaving(true);
    try {
      await apiService.replaceMflPicks(filled, token);
      setStatus({ type: "success", message: "Picks saved." });
    } catch (error) {
      setStatus({ type: "error", message: failureMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  const busy = authLoading || loading || catalogueLoading;

  return (
    <div>
      <p className="text-letterboxd-text-secondary mb-4">
        <Link to="/mfl" className="underline hover:no-underline">
          Eligible movies
        </Link>
      </p>
      <h1 className="text-2xl font-bold text-letterboxd-text-primary mb-4">
        My picks
      </h1>

      {!isLinked ? (
        <p className="text-letterboxd-text-secondary">
          Your account has no Letterboxd username linked. Ask an admin to link
          one before picking films.
        </p>
      ) : busy ? (
        <Spinner />
      ) : (
        <div className="max-w-2xl">
          {status.type !== "idle" && (
            <div className="mb-4">
              <Notification status={status} />
            </div>
          )}

          <ul className="flex flex-col gap-2">
            {slots.map((slug, index) => (
              <Slot
                key={index}
                index={index}
                slug={slug}
                film={bySlug.get(slug)}
                options={byPrice}
                takenElsewhere={takenElsewhere(index)}
                disabled={saving}
                onSelect={handleSelect}
                onClear={handleClear}
              />
            ))}
          </ul>

          <div className="mt-6 flex items-baseline justify-between gap-4 border-t-2 border-letterboxd-border pt-4">
            <span className="text-lg font-bold text-letterboxd-text-primary">
              Your total spend
            </span>
            {/* The parenthetical carries the state, not the colour: red alone
                fails 1.4.1 and says nothing to a screen reader. */}
            <span
              className={`text-lg font-bold tabular-nums text-right ${
                overBudget
                  ? "text-letterboxd-error"
                  : "text-letterboxd-text-primary"
              }`}
            >
              ${totalSpend}
              {overBudget && " (over budget)"}
            </span>
          </div>

          <p
            aria-live="polite"
            className="mt-2 text-sm text-letterboxd-text-secondary"
          >
            {filled.length} of {ROSTER_SIZE} movies selected
            {overBudget && `, $${totalSpend - BUDGET} over the $${BUDGET} budget`}
          </p>

          <button
            type="button"
            className="btn-primary mt-6 w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!complete || overBudget || saving}
            onClick={handleSubmit}
          >
            {saving ? "Saving…" : "Submit picks"}
          </button>
        </div>
      )}
    </div>
  );
};

export default MyPicks;
