import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Spinner from "../Spinner";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Notification, Status } from "../ui/Notification";
import { MoviePickerModal } from "./MoviePickerModal";
import { useMflData } from "../../hooks/useMflData";
import { useAuth } from "../../contexts/AuthContext";
import apiService from "../../services/api";
import { failureMessage } from "../../lib/failureMessage";
import { NO_LBUSERNAME_MESSAGE } from "../../../shared/utilities";
import { MFLCatalogueFilm, MFLRoster } from "../../types";

// Vulture's rules, mirrored here only. The server validates data integrity, not
// roster size or spend, so a rule change there does not need a deploy here.
const ROSTER_SIZE = 8;
const BUDGET = 100;
const MAX_NAME_LENGTH = 80;
const EMPTY = "";
const NEW = "new";

const priceOf = (film: MFLCatalogueFilm | undefined) => film?.price ?? 0;
const emptySlots = () => Array<string>(ROSTER_SIZE).fill(EMPTY);

interface SlotProps {
  index: number;
  film: MFLCatalogueFilm | undefined;
  disabled: boolean;
  onOpen: (index: number) => void;
  onClear: (index: number) => void;
}

const Slot = ({ index, film, disabled, onOpen, onClear }: SlotProps) => (
  <li className="flex items-center gap-2 sm:gap-3 rounded-lg border border-letterboxd-border-light bg-letterboxd-bg-secondary px-3 sm:px-4">
    <button
      type="button"
      disabled={disabled}
      onClick={() => onOpen(index)}
      className="min-w-0 flex-1 truncate py-3 text-left text-letterboxd-text-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span aria-hidden="true">{film ? film.title : "Select movie"}</span>
      <span className="sr-only">
        {film ? `Change ${film.title}` : "Select a movie"}, slot {index + 1}
      </span>
    </button>

    <span className="shrink-0 tabular-nums font-medium text-letterboxd-text-primary">
      ${priceOf(film)}
    </span>

    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={film ? `Remove ${film.title}` : `Clear slot ${index + 1}`}
      disabled={disabled || !film}
      onClick={() => onClear(index)}
      className="shrink-0 text-letterboxd-text-secondary disabled:invisible"
    >
      <span aria-hidden="true" className="text-lg leading-none">
        ✕
      </span>
    </Button>
  </li>
);

const MyPicks = () => {
  const { token, user, loading: authLoading } = useAuth();
  const {
    movies,
    loading: catalogueLoading,
    error: catalogueError,
  } = useMflData();

  const [rosters, setRosters] = useState<MFLRoster[]>([]);
  // null means the create-a-new-roster form; a number selects an existing one.
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [name, setName] = useState(EMPTY);
  const [isOfficial, setIsOfficial] = useState(false);
  const [slots, setSlots] = useState<string[]>(emptySlots);
  const [editing, setEditing] = useState<number | null>(null);
  const [rostersLoading, setRostersLoading] = useState(true);
  const [picksLoading, setPicksLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [status, setStatus] = useState<Status>({ type: "idle" });

  const isLinked = Boolean(user?.lbusername);
  const isCreate = selectedId === null;

  useEffect(() => {
    // Judging isLinked before /me resolves would flash the create form at a
    // member who already has rosters.
    if (authLoading) return;
    if (!token || !isLinked) {
      setRostersLoading(false);
      return;
    }
    const controller = new AbortController();

    async function loadRosters(authToken: string) {
      try {
        const response = await apiService.getMflRosters(
          authToken,
          controller.signal,
        );
        const loaded = response.data ?? [];
        setRosters(loaded);
        setSelectedId(loaded[0]?.rosterId ?? null);
        setName(loaded[0]?.name ?? EMPTY);
        setIsOfficial(loaded[0]?.isOfficial ?? false);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        setStatus({ type: "error", message: failureMessage(error) });
      } finally {
        setRostersLoading(false);
      }
    }

    loadRosters(token);
    return () => controller.abort();
  }, [authLoading, token, isLinked]);

  // Fetch only. The selected roster's name and the empty-form reset are set by
  // whoever changes the selection (below), so this depends on selectedId alone
  // and never refetches just because the roster list was refreshed after a save.
  useEffect(() => {
    if (!token || selectedId === null) return;

    const controller = new AbortController();
    async function loadPicks(authToken: string, rosterId: number) {
      setPicksLoading(true);
      try {
        const response = await apiService.getMflRosterPicks(
          rosterId,
          authToken,
          controller.signal,
        );
        const saved = (response.data ?? []).map((pick) => pick.filmSlug);
        setSlots(Array.from({ length: ROSTER_SIZE }, (_, i) => saved[i] ?? EMPTY));
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        setStatus({ type: "error", message: failureMessage(error) });
      } finally {
        setPicksLoading(false);
      }
    }

    loadPicks(token, selectedId);
    return () => controller.abort();
  }, [token, selectedId]);

  const bySlug = useMemo(
    () => new Map(movies.map((movie) => [movie.filmSlug, movie])),
    [movies],
  );

  // One set for the whole page rather than one per slot; the picker removes the
  // slot being edited from it as it opens.
  const pickedSlugs = useMemo(
    () => new Set(slots.filter((slug) => slug !== EMPTY)),
    [slots],
  );

  const filled = slots.filter((slug) => slug !== EMPTY);
  const totalSpend = filled.reduce(
    (total, slug) => total + priceOf(bySlug.get(slug)),
    0,
  );
  const overBudget = totalSpend > BUDGET;
  const complete = filled.length === ROSTER_SIZE;
  const trimmedName = name.trim();
  const nameValid = trimmedName.length > 0 && trimmedName.length <= MAX_NAME_LENGTH;
  const canSubmit =
    complete && !overBudget && nameValid && !saving && !picksLoading;

  const handlePick = (filmSlug: string) => {
    const index = editing;
    if (index === null) return;
    setStatus({ type: "idle" });
    setSlots((prev) => prev.map((cur, i) => (i === index ? filmSlug : cur)));
    setEditing(null);
  };

  const handleClear = (index: number) => {
    setStatus({ type: "idle" });
    setSlots((prev) => prev.map((cur, i) => (i === index ? EMPTY : cur)));
  };

  // Switching selection is an event, so it sets the form state here rather than
  // in an effect. The picks effect keys on selectedId and does the fetch.
  const chooseRoster = (value: string) => {
    setConfirmingDelete(false);
    setStatus({ type: "idle" });
    if (value === NEW) {
      setSelectedId(null);
      setName(EMPTY);
      setIsOfficial(false);
      setSlots(emptySlots());
      return;
    }
    const id = Number(value);
    const roster = rosters.find((r) => r.rosterId === id);
    setSelectedId(id);
    setName(roster?.name ?? EMPTY);
    setIsOfficial(roster?.isOfficial ?? false);
  };

  async function refreshRosters(authToken: string): Promise<MFLRoster[]> {
    const response = await apiService.getMflRosters(authToken);
    const loaded = response.data ?? [];
    setRosters(loaded);
    return loaded;
  }

  const handleSubmit = async () => {
    if (!token || !canSubmit) return;
    setStatus({ type: "idle" });
    setSaving(true);
    try {
      if (isCreate) {
        const response = await apiService.createMflRoster(
          trimmedName,
          filled,
          isOfficial,
          token,
        );
        await refreshRosters(token);
        setSelectedId(response.data?.rosterId ?? null);
        setStatus({ type: "success", message: "Roster created." });
      } else {
        await apiService.updateMflRoster(
          selectedId,
          { name: trimmedName, filmSlugs: filled, isOfficial },
          token,
        );
        await refreshRosters(token);
        setStatus({ type: "success", message: "Picks saved." });
      }
    } catch (error) {
      setStatus({ type: "error", message: failureMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!token || selectedId === null) return;
    setStatus({ type: "idle" });
    setSaving(true);
    try {
      await apiService.deleteMflRoster(selectedId, token);
      const remaining = await refreshRosters(token);
      const next = remaining[0] ?? null;
      setConfirmingDelete(false);
      setSelectedId(next?.rosterId ?? null);
      setName(next?.name ?? EMPTY);
      setIsOfficial(next?.isOfficial ?? false);
      if (!next) setSlots(emptySlots());
      setStatus({ type: "success", message: "Roster deleted." });
    } catch (error) {
      setStatus({ type: "error", message: failureMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  const busy = authLoading || rostersLoading || catalogueLoading;

  // Every price on this page comes from the catalogue. Without it the roster
  // would render with each film at $0 and a total that is simply wrong.
  const blocked = !busy && isLinked && Boolean(catalogueError);

  return (
    <div>
      <h1 className="text-2xl font-bold text-letterboxd-text-primary mb-4">
        Vulture Movies Fantasy League 2026-2027
      </h1>
      <p className="text-letterboxd-text-secondary mb-4">
        <Link to="/mfl" className="underline hover:no-underline">
          Eligible movies
        </Link>
      </p>
      <h1 className="text-xl font-bold text-letterboxd-text-primary mb-4">
        My picks
      </h1>

      {!isLinked && !busy ? (
        <p className="text-letterboxd-text-secondary">{NO_LBUSERNAME_MESSAGE}</p>
      ) : busy ? (
        <Spinner />
      ) : blocked ? (
        <Notification
          status={{
            type: "error",
            message: `${catalogueError}. Prices are unavailable, so picks cannot be edited right now.`,
          }}
        />
      ) : (
        <div className="max-w-2xl">
          {status.type !== "idle" && (
            <div className="mb-4">
              <Notification status={status} />
            </div>
          )}

          {rosters.length > 0 && (
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1 w-full sm:w-64">
                <label
                  htmlFor="roster-select"
                  className="text-sm font-medium text-letterboxd-text-secondary"
                >
                  Roster
                </label>
                <div className="select-wrapper">
                  <select
                    id="roster-select"
                    value={selectedId === null ? NEW : String(selectedId)}
                    disabled={saving}
                    onChange={(e) => chooseRoster(e.target.value)}
                    className="input-field w-full"
                  >
                    {rosters.map((roster) => (
                      <option key={roster.rosterId} value={String(roster.rosterId)}>
                        {roster.isOfficial ? `${roster.name} (official)` : roster.name}
                      </option>
                    ))}
                    <option value={NEW}>+ New roster</option>
                  </select>
                </div>
              </div>

              {!isCreate &&
                (confirmingDelete ? (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={saving}
                      onClick={handleDelete}
                    >
                      Confirm delete
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={saving}
                      onClick={() => setConfirmingDelete(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={saving}
                    onClick={() => setConfirmingDelete(true)}
                  >
                    Delete roster
                  </Button>
                ))}
            </div>
          )}

          <div className="mb-4 flex flex-col gap-1">
            <label
              htmlFor="roster-name"
              className="text-sm font-medium text-letterboxd-text-secondary"
            >
              Roster name
            </label>
            <Input
              id="roster-name"
              type="text"
              value={name}
              maxLength={MAX_NAME_LENGTH}
              disabled={saving || picksLoading}
              placeholder="My Movie Picks"
              onChange={(e) => setName(e.target.value)}
              className="w-full sm:w-80"
            />
            <label
              htmlFor="roster-official"
              className="mt-1 flex items-center gap-2 text-sm text-letterboxd-text-secondary"
            >
              <input
                id="roster-official"
                type="checkbox"
                checked={isOfficial}
                disabled={saving || picksLoading}
                onChange={(e) => setIsOfficial(e.target.checked)}
                className="w-4 h-4 rounded-xs border border-letterboxd-border-light bg-letterboxd-bg-secondary"
              />
              Make this my official roster
            </label>
          </div>

          <ul className="flex flex-col gap-2">
            {slots.map((slug, index) => (
              <Slot
                key={index}
                index={index}
                film={bySlug.get(slug)}
                disabled={saving || picksLoading}
                onOpen={setEditing}
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
            id="roster-progress"
            aria-live="polite"
            className="mt-2 text-sm text-letterboxd-text-secondary"
          >
            {filled.length} of {ROSTER_SIZE} movies selected
            {overBudget && `, $${totalSpend - BUDGET} over the $${BUDGET} budget`}
          </p>

          <Button
            type="button"
            className="mt-6 w-full sm:w-auto"
            aria-describedby="roster-progress"
            disabled={!canSubmit}
            loading={saving}
            onClick={handleSubmit}
          >
            {isCreate ? "Create roster" : "Save picks"}
          </Button>

          {editing !== null && (
            <MoviePickerModal
              isOpen
              slotNumber={editing + 1}
              movies={movies}
              taken={
                new Set(
                  [...pickedSlugs].filter((slug) => slug !== slots[editing]),
                )
              }
              onPick={handlePick}
              onClose={() => setEditing(null)}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default MyPicks;
