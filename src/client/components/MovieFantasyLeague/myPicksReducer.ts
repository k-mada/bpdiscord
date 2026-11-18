import type { Status } from "../ui/Notification";
import type { MFLRoster } from "../../types";

export const ROSTER_SIZE = 8;
export const EMPTY = "";

export const emptySlots = () => Array<string>(ROSTER_SIZE).fill(EMPTY);

/**
 * Where the page is in its load/save cycle. Only `ready` means the slots are
 * the selected roster's picks (or the create form), so only `ready` may edit
 * or submit them. `saving` remembers the phase to return to if the request fails.
 */
export type Phase =
  | { kind: "loadingRosters" }
  | { kind: "loadingPicks" }
  | { kind: "picksFailed" }
  | { kind: "ready" }
  | { kind: "saving"; resume: "ready" | "picksFailed" };

export interface MyPicksState {
  rosters: MFLRoster[];
  /** null is the create-a-new-roster form; a number selects an existing one. */
  selectedId: number | null;
  name: string;
  isOfficial: boolean;
  slots: string[];
  /** The slot whose picker is open. */
  editing: number | null;
  confirmingDelete: boolean;
  phase: Phase;
  status: Status;
}

export type MyPicksAction =
  | { type: "rostersLoaded"; rosters: MFLRoster[] }
  | { type: "rostersUnavailable" }
  | { type: "rostersFailed"; message: string }
  | { type: "picksLoaded"; rosterId: number; filmSlugs: string[] }
  | { type: "picksFailed"; rosterId: number; message: string }
  | { type: "rosterSelected"; rosterId: number | null }
  | { type: "pickerOpened"; index: number }
  | { type: "pickerClosed" }
  | { type: "slotPicked"; filmSlug: string }
  | { type: "slotCleared"; index: number }
  | { type: "nameChanged"; name: string }
  | { type: "officialChanged"; isOfficial: boolean }
  | { type: "deleteRequested" }
  | { type: "deleteCancelled" }
  | { type: "mutationStarted" }
  | { type: "created"; rosters: MFLRoster[]; rosterId: number | null }
  | { type: "updated"; rosters: MFLRoster[] }
  | { type: "deleted"; rosters: MFLRoster[] }
  | { type: "mutationFailed"; message: string };

export const initialMyPicksState: MyPicksState = {
  rosters: [],
  selectedId: null,
  name: EMPTY,
  isOfficial: false,
  slots: emptySlots(),
  editing: null,
  confirmingDelete: false,
  phase: { kind: "loadingRosters" },
  status: { type: "idle" },
};

const IDLE: Status = { type: "idle" };

/** Points the form at a roster, or at the create form when rosterId is null. */
function select(
  state: MyPicksState,
  rosterId: number | null,
): MyPicksState {
  const roster = state.rosters.find((r) => r.rosterId === rosterId);
  return {
    ...state,
    selectedId: roster ? roster.rosterId : null,
    name: roster?.name ?? EMPTY,
    isOfficial: roster?.isOfficial ?? false,
    slots: emptySlots(),
    editing: null,
    confirmingDelete: false,
    phase: roster ? { kind: "loadingPicks" } : { kind: "ready" },
  };
}

const setSlot = (slots: string[], index: number, slug: string) =>
  slots.map((cur, i) => (i === index ? slug : cur));

export function myPicksReducer(
  state: MyPicksState,
  action: MyPicksAction,
): MyPicksState {
  switch (action.type) {
    case "rostersLoaded":
      return select(
        { ...state, rosters: action.rosters },
        action.rosters[0]?.rosterId ?? null,
      );

    case "rostersUnavailable":
      return { ...state, phase: { kind: "ready" } };

    case "rostersFailed":
      return {
        ...state,
        phase: { kind: "ready" },
        status: { type: "error", message: action.message },
      };

    // A response for a roster that is no longer selected is stale; applying it
    // would put one roster's picks under another's name.
    case "picksLoaded":
      if (action.rosterId !== state.selectedId) return state;
      if (state.phase.kind !== "loadingPicks") return state;
      return {
        ...state,
        slots: Array.from(
          { length: ROSTER_SIZE },
          (_, i) => action.filmSlugs[i] ?? EMPTY,
        ),
        phase: { kind: "ready" },
      };

    case "picksFailed":
      if (action.rosterId !== state.selectedId) return state;
      if (state.phase.kind !== "loadingPicks") return state;
      return {
        ...state,
        phase: { kind: "picksFailed" },
        status: { type: "error", message: action.message },
      };

    case "rosterSelected":
      return { ...select(state, action.rosterId), status: IDLE };

    case "pickerOpened":
      return { ...state, editing: action.index };

    case "pickerClosed":
      return { ...state, editing: null };

    case "slotPicked":
      if (state.editing === null) return state;
      return {
        ...state,
        slots: setSlot(state.slots, state.editing, action.filmSlug),
        editing: null,
        status: IDLE,
      };

    case "slotCleared":
      return {
        ...state,
        slots: setSlot(state.slots, action.index, EMPTY),
        status: IDLE,
      };

    case "nameChanged":
      return { ...state, name: action.name };

    case "officialChanged":
      return { ...state, isOfficial: action.isOfficial };

    case "deleteRequested":
      return { ...state, confirmingDelete: true };

    case "deleteCancelled":
      return { ...state, confirmingDelete: false };

    case "mutationStarted":
      if (state.phase.kind !== "ready" && state.phase.kind !== "picksFailed") {
        return state;
      }
      return {
        ...state,
        phase: { kind: "saving", resume: state.phase.kind },
        status: IDLE,
      };

    // The new roster's picks are refetched like any other selection, so the
    // form stays locked until the server confirms what it stored.
    case "created":
      return {
        ...state,
        rosters: action.rosters,
        selectedId: action.rosterId,
        phase:
          action.rosterId === null ? { kind: "ready" } : { kind: "loadingPicks" },
        status: { type: "success", message: "Roster created." },
      };

    case "updated":
      return {
        ...state,
        rosters: action.rosters,
        phase: { kind: "ready" },
        status: { type: "success", message: "Picks saved." },
      };

    case "deleted":
      return {
        ...select(
          { ...state, rosters: action.rosters },
          action.rosters[0]?.rosterId ?? null,
        ),
        status: { type: "success", message: "Roster deleted." },
      };

    case "mutationFailed":
      return {
        ...state,
        phase:
          state.phase.kind === "saving"
            ? { kind: state.phase.resume }
            : state.phase,
        status: { type: "error", message: action.message },
      };
  }
}
