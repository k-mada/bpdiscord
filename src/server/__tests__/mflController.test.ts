/**
 * Wire-shape tests for the MFL read handlers.
 *
 * The DB layer returns snake_case and getMFLMovies renames film_slug to
 * filmSlug for the client. Nothing tested that rename: dataController.test.ts
 * asserts the snake_case side, api.test.ts asserts a payload it mocked itself,
 * and mflRoutes.test.ts asserts middleware names. Deleting the map broke the
 * /mfl dropdown with the whole suite still green.
 *
 * Run with: yarn test
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { mockReqRes } from "./helpers/mockReqRes";

// Hoisted so the controller picks up the stub at import time. Covers the
// response contract only; the queries are dataController.test.ts's job.
vi.mock('../controllers/dataController', () => ({
  dbGetMFLMovies: vi.fn(),
  dbGetMFLUserScores: vi.fn(),
  dbGetMFLScoringMetrics: vi.fn(),
  dbGetMflMovieScore: vi.fn(),
  dbUpsertMflMovieScore: vi.fn(),
  dbDeleteMflMovieScore: vi.fn(),
}));

import { getMFLMovies, getMFLUserScores } from '../controllers/mflController';
import {
  dbGetMFLMovies,
  dbGetMFLUserScores,
} from '../controllers/dataController';



beforeEach(() => {
  vi.resetAllMocks();
});

describe('getMFLMovies', () => {
  it('renames film_slug to filmSlug for the client', async () => {
    vi.mocked(dbGetMFLMovies).mockResolvedValue({
      success: true,
      data: [{ title: 'Zulu Dawn', film_slug: 'zulu-dawn' }],
    } as never);

    const { req, res, statusCalls, jsonCalls } = mockReqRes();
    await getMFLMovies(req, res);

    expect(statusCalls).toEqual([]);
    expect(jsonCalls[0]).toMatchObject({
      data: [{ title: 'Zulu Dawn', filmSlug: 'zulu-dawn' }],
    });
  });

  it('emits no snake_case key the client would miss', async () => {
    vi.mocked(dbGetMFLMovies).mockResolvedValue({
      success: true,
      data: [{ title: 'Zulu Dawn', film_slug: 'zulu-dawn' }],
    } as never);

    const { req, res, jsonCalls } = mockReqRes();
    await getMFLMovies(req, res);

    const [movie] = (jsonCalls[0] as { data: Record<string, unknown>[] }).data;
    expect(Object.keys(movie).sort()).toEqual(['filmSlug', 'title']);
  });

  it('returns an empty list rather than failing when no season is loaded', async () => {
    vi.mocked(dbGetMFLMovies).mockResolvedValue({
      success: true,
      data: [],
    } as never);

    const { req, res, statusCalls, jsonCalls } = mockReqRes();
    await getMFLMovies(req, res);

    expect(statusCalls).toEqual([]);
    expect(jsonCalls[0]).toMatchObject({ data: [] });
  });

  it('500s when the query fails', async () => {
    vi.mocked(dbGetMFLMovies).mockResolvedValue({
      success: false,
      error: 'boom',
    } as never);

    const { req, res, statusCalls } = mockReqRes();
    await getMFLMovies(req, res);

    expect(statusCalls).toEqual([500]);
  });
});

describe('getMFLUserScores', () => {
  const row = {
    username: 'alice_lb',
    metric_id: 9001,
    points_awarded: 25,
    category: 'awards',
  };

  it('passes the score rows through unchanged', async () => {
    vi.mocked(dbGetMFLUserScores).mockResolvedValue({
      success: true,
      data: [row],
    } as never);

    const { req, res, statusCalls, jsonCalls } = mockReqRes({ params: {
      username: 'alice_lb',
    } });
    await getMFLUserScores(req, res);

    expect(statusCalls).toEqual([]);
    expect(jsonCalls[0]).toMatchObject({ data: [row] });
    expect(dbGetMFLUserScores).toHaveBeenCalledWith('alice_lb');
  });

  it('keeps the snake_case score keys the response shape promises', async () => {
    vi.mocked(dbGetMFLUserScores).mockResolvedValue({
      success: true,
      data: [row],
    } as never);

    const { req, res, jsonCalls } = mockReqRes({ params: { username: 'alice_lb' } });
    await getMFLUserScores(req, res);

    const [score] = (jsonCalls[0] as { data: Record<string, unknown>[] }).data;
    expect(Object.keys(score).sort()).toEqual([
      'category',
      'metric_id',
      'points_awarded',
      'username',
    ]);
  });

  it('400s without a username', async () => {
    const { req, res, statusCalls } = mockReqRes({ params: {} });
    await getMFLUserScores(req, res);

    expect(statusCalls).toEqual([400]);
    expect(dbGetMFLUserScores).not.toHaveBeenCalled();
  });

  it('500s when the query fails', async () => {
    vi.mocked(dbGetMFLUserScores).mockResolvedValue({
      success: false,
      error: 'boom',
    } as never);

    const { req, res, statusCalls } = mockReqRes({ params: { username: 'alice_lb' } });
    await getMFLUserScores(req, res);

    expect(statusCalls).toEqual([500]);
  });
});
