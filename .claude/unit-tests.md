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
