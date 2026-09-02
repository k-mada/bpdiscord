---
description: Test conventions for the BPDiscord codebase — file layout, shared factories, and helper rules. Follow these when adding or moving any test file under src/client/__tests__ or src/server/__tests__.
globs: *.ts,*.tsx
---

# Test Conventions

Runner is **Vitest** (`vitest run --coverage` in both workspaces), not Jest. Use `vi.mock` / `vi.spyOn` / `vi.useFakeTimers`. `@testing-library/jest-dom` is present for its matchers only — it does not imply Jest.

Generic testing advice is intentionally absent here. These are the rules specific to this repo.

## 1. Centralized `__tests__` directories

Place every test file in a single `__tests__` directory per workspace: `src/client/__tests__/` and `src/server/__tests__/`.

- Do **not** colocate tests next to their source files.
- Do **not** create nested `__tests__` folders inside subdirectories (`components/__tests__/`, `hooks/__tests__/`).
- When a test targets a subdirectory util (e.g. `components/oscars/utils.ts`), prefix the filename to disambiguate: `oscarsUtils.test.ts`, `eventsUtils.test.ts`.

## 2. Use the fetch-hook lifecycle factory

Hooks that follow the fetch-on-mount shape (`loading`, `error`, `data`, `refetch`) get their standard lifecycle tests from `describeFetchHookLifecycle` in `src/client/__tests__/helpers/hookTestFactory.ts` — initial loading, success, undefined data, error, error clearing on refetch, and refetch replacing data.

Individual test files should only add hook-specific cases on top of the factory. Current consumers: `useMflData`, `useAwardShows`, `useHaterRankings`, `useComparison`.

## 3. Extract `renderLoadedHook()` for post-load assertions

When several tests in a hook file need the hook fully loaded before exercising one method, extract a `renderLoadedHook()` async helper that mocks the initial fetch, renders, waits for loading to finish, and returns the result. Avoids repeating the same five or six lines of mock setup per case. See `useMflData.test.ts` and `useComparison.test.ts`.

## 4. Never put `expect()` inside seed or setup helpers

Seed helpers that insert data before a test runs must `throw new Error("descriptive message")` instead of asserting.

An assertion inside a helper reports the failure at the helper, not the test that triggered it. A throw produces a self-documenting error — `"Seed failed: dbCreateAwardShow[0]: unique constraint violation"`. Keep `expect()` exclusively inside `it()` blocks.

## 5. Shared logic gets one implementation and one fixture

Logic used by both workspaces lives in `src/shared/`, and its test cases live beside it. `parseRatingFromTitle` and `extractRatingCount` are the worked example: both are defined once in `src/shared/utilities.ts`, `src/client/utilities.ts` imports them rather than reimplementing, and the input/expected pairs live once in `src/shared/testFixtures/ratingTestCases.ts`.

Run shared cases with `it.each(cases)`. If you find the same helper written out in both `src/client/` and `src/server/`, move it to `src/shared/` rather than adding a second set of tests to keep in sync.

## 6. Server tests share one database — never run the files in parallel

Every DB-backed server test file truncates shared tables in `beforeEach`. Two files running at once therefore delete each other's rows mid-test, and the failures surface far from the cause as foreign-key violations in whichever file lost the race.

`fileParallelism: false` in the server Vitest config is what prevents this. Note that `sequence.concurrent` is **not** the same setting — it only orders tests within a single file, so a config carrying just that one looks correct while the files still run in parallel workers. Don't "optimise" the parallelism back on; the whole server suite runs in a couple of seconds serially.

The symptom, if it regresses: failure counts that change between identical runs. A suite that reports a different number each time is not gating anything, and the only safe way to attribute a change is to diff failing test *names* against a stashed baseline.

## 7. A DB-backed test file resets everything it writes

`cleanDatabase()` in `beforeEach` is the default — it clears every table in FK-safe order. A file that resets only its own tables must still clear anything it inserted transitively, `Users` especially: seeding an account and leaving the row behind changes the answer for any later file that counts users.

This is also what keeps the smoke fixtures out of the way. `yarn setup:local` seeds into the same local Supabase instance the tests use, so per-file reset is the only reason `yarn setup:local && yarn test` passes.
