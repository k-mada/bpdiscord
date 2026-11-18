import { useEffect, useMemo, useReducer } from "react";
import { Link } from "react-router-dom";
import Spinner from "../Spinner";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Notification } from "../ui/Notification";
import { MoviePickerModal } from "./MoviePickerModal";
import { useMflData } from "../../hooks/useMflData";
import { useAuth } from "../../contexts/AuthContext";
import apiService from "../../services/api";
import { failureMessage } from "../../lib/failureMessage";
import { NO_LBUSERNAME_MESSAGE } from "../../../shared/utilities";
import { MFLCatalogueFilm, MFLRoster } from "../../types";
import {
  EMPTY,
  ROSTER_SIZE,
  initialMyPicksState,
  myPicksReducer,
} from "./myPicksReducer";

// Vulture's rules, mirrored here only. The server validates data integrity, not
// roster size or spend, so a rule change there does not need a deploy here.
const BUDGET = 100;
const MAX_NAME_LENGTH = 80;
const NEW = "new";

const priceOf = (film: MFLCatalogueFilm | undefined) => film?.price ?? 0;

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

    <span className="shrink-0 tabular-nums type-strong text-letterboxd-text-primary">
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
      <span aria-hidden="true" className="icon-glyph">
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

  const [state, dispatch] = useReducer(myPicksReducer, initialMyPicksState);
  const { rosters, selectedId, name, isOfficial, slots, editing, phase, status } =
    state;

  const isLinked = Boolean(user?.lbusername);
  const isCreate = selectedId === null;

  useEffect(() => {
    // Judging isLinked before /me resolves would flash the create form at a
    // member who already has rosters.
    if (authLoading) return;
    if (!token || !isLinked) {
      dispatch({ type: "rostersUnavailable" });
      return;
    }
    const controller = new AbortController();

    async function loadRosters(authToken: string) {
      try {
        const response = await apiService.getMflRosters(
          authToken,
          controller.signal,
        );
        dispatch({ type: "rostersLoaded", rosters: response.data ?? [] });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        dispatch({ type: "rostersFailed", message: failureMessage(error) });
      }
    }

    loadRosters(token);
    return () => controller.abort();
  }, [authLoading, token, isLinked]);

  // Keys on selectedId alone, so refreshing the roster list after a save does
  // not refetch. The reducer resets the form whenever the selection changes.
  useEffect(() => {
    if (!token || selectedId === null) return;

    const controller = new AbortController();
    async function loadPicks(authToken: string, rosterId: number) {
      try {
        const response = await apiService.getMflRosterPicks(
          rosterId,
          authToken,
          controller.signal,
        );
        dispatch({
          type: "picksLoaded",
          rosterId,
          filmSlugs: (response.data ?? []).map((pick) => pick.filmSlug),
        });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        dispatch({
          type: "picksFailed",
          rosterId,
          message: failureMessage(error),
        });
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
  const saving = phase.kind === "saving";
  const locked = phase.kind !== "ready";
  const canDelete = phase.kind === "ready" || phase.kind === "picksFailed";
  const canSubmit = complete && !overBudget && nameValid && !locked;

  const chooseRoster = (value: string) =>
    dispatch({
      type: "rosterSelected",
      rosterId: value === NEW ? null : Number(value),
    });

  async function fetchRosters(authToken: string): Promise<MFLRoster[]> {
    const response = await apiService.getMflRosters(authToken);
    return response.data ?? [];
  }

  const handleSubmit = async () => {
    if (!token || !canSubmit) return;
    dispatch({ type: "mutationStarted" });
    try {
      if (isCreate) {
        const response = await apiService.createMflRoster(
          trimmedName,
          filled,
          isOfficial,
          token,
        );
        dispatch({
          type: "created",
          rosters: await fetchRosters(token),
          rosterId: response.data?.rosterId ?? null,
        });
      } else {
        await apiService.updateMflRoster(
          selectedId,
          { name: trimmedName, filmSlugs: filled, isOfficial },
          token,
        );
        dispatch({ type: "updated", rosters: await fetchRosters(token) });
      }
    } catch (error) {
      dispatch({ type: "mutationFailed", message: failureMessage(error) });
    }
  };

  const handleDelete = async () => {
    if (!token || selectedId === null || !canDelete) return;
    dispatch({ type: "mutationStarted" });
    try {
      await apiService.deleteMflRoster(selectedId, token);
      dispatch({ type: "deleted", rosters: await fetchRosters(token) });
    } catch (error) {
      dispatch({ type: "mutationFailed", message: failureMessage(error) });
    }
  };

  const busy =
    authLoading || phase.kind === "loadingRosters" || catalogueLoading;

  // Every price on this page comes from the catalogue. Without it the roster
  // would render with each film at $0 and a total that is simply wrong.
  const blocked = !busy && isLinked && Boolean(catalogueError);

  return (
    <div>
      <h1 className="type-h1 text-letterboxd-text-primary mb-4">
        Vulture Movies Fantasy League 2026-2027
      </h1>
      <p className="text-letterboxd-text-secondary mb-4">
        <Link to="/mfl" className="underline hover:no-underline">
          Eligible movies
        </Link>
      </p>
      <h1 className="type-h2 text-letterboxd-text-primary mb-4">
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
                  className="type-body-strong text-letterboxd-text-secondary"
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
                (state.confirmingDelete ? (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={!canDelete}
                      onClick={handleDelete}
                    >
                      Confirm delete
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={saving}
                      onClick={() => dispatch({ type: "deleteCancelled" })}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={!canDelete}
                    onClick={() => dispatch({ type: "deleteRequested" })}
                  >
                    Delete roster
                  </Button>
                ))}
            </div>
          )}

          <div className="mb-4 flex flex-col gap-1">
            <label
              htmlFor="roster-name"
              className="type-body-strong text-letterboxd-text-secondary"
            >
              Roster name
            </label>
            <Input
              id="roster-name"
              type="text"
              value={name}
              maxLength={MAX_NAME_LENGTH}
              disabled={locked}
              placeholder="My Movie Picks"
              onChange={(e) =>
                dispatch({ type: "nameChanged", name: e.target.value })
              }
              className="w-full sm:w-80"
            />
            <label
              htmlFor="roster-official"
              className="mt-1 flex items-center gap-2 type-body-sm text-letterboxd-text-secondary"
            >
              <input
                id="roster-official"
                type="checkbox"
                checked={isOfficial}
                disabled={locked}
                onChange={(e) =>
                  dispatch({
                    type: "officialChanged",
                    isOfficial: e.target.checked,
                  })
                }
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
                disabled={locked}
                onOpen={(index) => dispatch({ type: "pickerOpened", index })}
                onClear={(index) => dispatch({ type: "slotCleared", index })}
              />
            ))}
          </ul>

          <div className="mt-6 flex items-baseline justify-between gap-4 border-t-2 border-letterboxd-border pt-4">
            <span className="type-h3 text-letterboxd-text-primary">
              Your total spend
            </span>
            {/* The parenthetical carries the state, not the colour: red alone
                fails 1.4.1 and says nothing to a screen reader. */}
            <span
              className={`type-h3 tabular-nums text-right ${
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
            className="mt-2 type-body-sm text-letterboxd-text-secondary"
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
              onPick={(filmSlug) => dispatch({ type: "slotPicked", filmSlug })}
              onClose={() => dispatch({ type: "pickerClosed" })}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default MyPicks;
