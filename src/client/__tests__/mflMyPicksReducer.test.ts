import {
  EMPTY,
  ROSTER_SIZE,
  initialMyPicksState,
  myPicksReducer,
  type MyPicksAction,
  type MyPicksState,
} from "../components/MovieFantasyLeague/myPicksReducer";
import type { MFLRoster } from "../types";

const ALPHA: MFLRoster = { rosterId: 7, name: "Alpha", isOfficial: true };
const BETA: MFLRoster = { rosterId: 8, name: "Beta", isOfficial: false };
const EIGHT = Array.from({ length: ROSTER_SIZE }, (_, i) => `film-${i}`);

const apply = (state: MyPicksState, ...actions: MyPicksAction[]) =>
  actions.reduce(myPicksReducer, state);

const run = (...actions: MyPicksAction[]) =>
  apply(initialMyPicksState, ...actions);

/** Alpha selected with its eight picks loaded and editable. */
const alphaReady = (): MyPicksState =>
  run(
    { type: "rostersLoaded", rosters: [ALPHA, BETA] },
    { type: "picksLoaded", rosterId: 7, filmSlugs: EIGHT },
  );

describe("myPicksReducer", () => {
  describe("loading", () => {
    it("selects the first roster and waits for its picks", () => {
      const state = run({ type: "rostersLoaded", rosters: [ALPHA, BETA] });

      expect(state).toMatchObject({
        selectedId: 7,
        name: "Alpha",
        isOfficial: true,
        phase: { kind: "loadingPicks" },
      });
    });

    it("opens the create form when there are no rosters", () => {
      const state = run({ type: "rostersLoaded", rosters: [] });

      expect(state.selectedId).toBeNull();
      expect(state.phase).toEqual({ kind: "ready" });
    });

    it("pads loaded picks out to the roster size", () => {
      const state = run(
        { type: "rostersLoaded", rosters: [ALPHA] },
        { type: "picksLoaded", rosterId: 7, filmSlugs: ["film-0"] },
      );

      expect(state.slots).toEqual(["film-0", ...Array(ROSTER_SIZE - 1).fill(EMPTY)]);
      expect(state.phase).toEqual({ kind: "ready" });
    });
  });

  describe("stale responses", () => {
    it("ignores picks for a roster that is no longer selected", () => {
      const switched = run(
        { type: "rostersLoaded", rosters: [ALPHA, BETA] },
        { type: "rosterSelected", rosterId: 8 },
      );

      const after = myPicksReducer(switched, {
        type: "picksLoaded",
        rosterId: 7,
        filmSlugs: EIGHT,
      });

      expect(after).toBe(switched);
    });

    it("ignores a failure for a roster that is no longer selected", () => {
      const switched = run(
        { type: "rostersLoaded", rosters: [ALPHA, BETA] },
        { type: "rosterSelected", rosterId: 8 },
      );

      const after = myPicksReducer(switched, {
        type: "picksFailed",
        rosterId: 7,
        message: "boom",
      });

      expect(after).toBe(switched);
    });
  });

  describe("selection", () => {
    it("clears the slots and locks until the new roster's picks arrive", () => {
      const state = myPicksReducer(alphaReady(), {
        type: "rosterSelected",
        rosterId: 8,
      });

      expect(state.slots).toEqual(Array(ROSTER_SIZE).fill(EMPTY));
      expect(state.phase).toEqual({ kind: "loadingPicks" });
      expect(state.name).toBe("Beta");
    });

    it("re-locks a roster that loaded before, rather than trusting the old load", () => {
      const state = run(
        { type: "rostersLoaded", rosters: [ALPHA, BETA] },
        { type: "picksLoaded", rosterId: 7, filmSlugs: EIGHT },
        { type: "rosterSelected", rosterId: 8 },
        { type: "picksFailed", rosterId: 8, message: "boom" },
        { type: "rosterSelected", rosterId: 7 },
      );

      expect(state.phase).toEqual({ kind: "loadingPicks" });
    });

    it("resets the delete confirmation and the status", () => {
      const state = run(
        { type: "rostersLoaded", rosters: [ALPHA, BETA] },
        { type: "picksFailed", rosterId: 7, message: "boom" },
        { type: "deleteRequested" },
        { type: "rosterSelected", rosterId: 8 },
      );

      expect(state.confirmingDelete).toBe(false);
      expect(state.status).toEqual({ type: "idle" });
    });
  });

  describe("slots", () => {
    it("fills the slot whose picker is open, then closes it", () => {
      const state = run(
        { type: "rostersLoaded", rosters: [] },
        { type: "pickerOpened", index: 2 },
        { type: "slotPicked", filmSlug: "film-9" },
      );

      expect(state.slots[2]).toBe("film-9");
      expect(state.editing).toBeNull();
    });

    it("ignores a pick with no picker open", () => {
      const ready = run({ type: "rostersLoaded", rosters: [] });

      expect(myPicksReducer(ready, { type: "slotPicked", filmSlug: "x" })).toBe(
        ready,
      );
    });
  });

  describe("mutations", () => {
    it("refuses to start while picks are loading", () => {
      const loading = run({ type: "rostersLoaded", rosters: [ALPHA] });

      expect(myPicksReducer(loading, { type: "mutationStarted" })).toBe(loading);
    });

    it("returns a failed delete to picksFailed, not to an editable form", () => {
      const state = run(
        { type: "rostersLoaded", rosters: [ALPHA] },
        { type: "picksFailed", rosterId: 7, message: "boom" },
        { type: "mutationStarted" },
        { type: "mutationFailed", message: "nope" },
      );

      expect(state.phase).toEqual({ kind: "picksFailed" });
      expect(state.status).toEqual({ type: "error", message: "nope" });
    });

    it("keeps the slots and stays editable after a failed save", () => {
      const state = apply(
        alphaReady(),
        { type: "mutationStarted" },
        { type: "mutationFailed", message: "nope" },
      );

      expect(state.phase).toEqual({ kind: "ready" });
      expect(state.slots).toEqual(EIGHT);
    });

    it("selects a created roster and reloads its picks", () => {
      const state = run(
        { type: "rostersLoaded", rosters: [] },
        { type: "mutationStarted" },
        { type: "created", rosters: [BETA], rosterId: 8 },
      );

      expect(state.selectedId).toBe(8);
      expect(state.phase).toEqual({ kind: "loadingPicks" });
      expect(state.status).toEqual({ type: "success", message: "Roster created." });
    });

    it("stays on the roster after an update", () => {
      const state = apply(
        alphaReady(),
        { type: "mutationStarted" },
        { type: "updated", rosters: [ALPHA, BETA] },
      );

      expect(state.selectedId).toBe(7);
      expect(state.phase).toEqual({ kind: "ready" });
      expect(state.slots).toEqual(EIGHT);
    });

    it("moves to the next roster after a delete", () => {
      const state = apply(
        alphaReady(),
        { type: "deleteRequested" },
        { type: "mutationStarted" },
        { type: "deleted", rosters: [BETA] },
      );

      expect(state).toMatchObject({
        selectedId: 8,
        confirmingDelete: false,
        phase: { kind: "loadingPicks" },
        status: { type: "success", message: "Roster deleted." },
      });
    });

    it("falls back to the create form when the last roster is deleted", () => {
      const state = apply(
        alphaReady(),
        { type: "mutationStarted" },
        { type: "deleted", rosters: [] },
      );

      expect(state.selectedId).toBeNull();
      expect(state.phase).toEqual({ kind: "ready" });
      expect(state.slots).toEqual(Array(ROSTER_SIZE).fill(EMPTY));
    });
  });
});
