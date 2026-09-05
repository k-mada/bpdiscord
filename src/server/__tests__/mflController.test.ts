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
  dbResolveLbusername: vi.fn(),
  dbGetMflUserPicks: vi.fn(),
  dbReplaceMflUserPicks: vi.fn(),
}));

import {
  getMFLMovies,
  getMFLUserScores,
  upsertMflMovieScore,
  getMflUserPicks,
  replaceMflUserPicks,
} from '../controllers/mflController';
import {
  dbGetMFLMovies,
  dbGetMFLUserScores,
  dbUpsertMflMovieScore,
  dbResolveLbusername,
  dbGetMflUserPicks,
  dbReplaceMflUserPicks,
} from '../controllers/dataController';



beforeEach(() => {
  vi.resetAllMocks();
});

describe('getMFLMovies', () => {
  it('renames every snake_case column for the client', async () => {
    vi.mocked(dbGetMFLMovies).mockResolvedValue({
      success: true,
      data: [{
        title: 'Zulu Dawn',
        film_slug: 'zulu-dawn',
        release_date: '2026-10-18',
        price: 40,
        total_points: 35,
        points_by_category: { awards: 25, box_office: 10 },
      }],
    } as never);

    const { req, res, statusCalls, jsonCalls } = mockReqRes();
    await getMFLMovies(req, res);

    expect(statusCalls).toEqual([]);
    expect(jsonCalls[0]).toMatchObject({
      data: [
        {
          title: 'Zulu Dawn',
          filmSlug: 'zulu-dawn',
          releaseDate: '2026-10-18',
          price: 40,
          totalPoints: 35,
          pointsByCategory: { awards: 25, box_office: 10 },
        },
      ],
    });
  });

  it('emits no snake_case key the client would miss', async () => {
    vi.mocked(dbGetMFLMovies).mockResolvedValue({
      success: true,
      data: [{
        title: 'Zulu Dawn',
        film_slug: 'zulu-dawn',
        release_date: '2026-10-18',
        price: 40,
        total_points: 35,
        points_by_category: { awards: 25, box_office: 10 },
      }],
    } as never);

    const { req, res, jsonCalls } = mockReqRes();
    await getMFLMovies(req, res);

    const [movie] = (jsonCalls[0] as { data: Record<string, unknown>[] }).data;
    expect(Object.keys(movie).sort()).toEqual([
      'filmSlug',
      'pointsByCategory',
      'price',
      'releaseDate',
      'title',
      'totalPoints',
    ]);
  });

  it('passes a null release date and price through rather than defaulting them', async () => {
    vi.mocked(dbGetMFLMovies).mockResolvedValue({
      success: true,
      data: [
        {
          title: 'Unpriced',
          film_slug: 'unpriced',
          release_date: null,
          price: null,
          total_points: 0,
          points_by_category: {},
        },
      ],
    } as never);

    const { req, res, jsonCalls } = mockReqRes();
    await getMFLMovies(req, res);

    expect(jsonCalls[0]).toMatchObject({
      data: [{ releaseDate: null, price: null, pointsByCategory: {} }],
    });
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

describe('upsertMflMovieScore', () => {
  const award = { filmSlug: 'zulu-dawn', pointsAwarded: 25, metricId: 9001 };

  it('accepts an award of zero points', async () => {
    vi.mocked(dbUpsertMflMovieScore).mockResolvedValue({ success: true });

    const { req, res, statusCalls } = mockReqRes({
      body: { ...award, pointsAwarded: 0 },
    });
    await upsertMflMovieScore(req, res);

    expect(statusCalls).toEqual([200]);
    expect(dbUpsertMflMovieScore).toHaveBeenCalledWith(
      'zulu-dawn',
      0,
      9001,
      undefined,
    );
  });

  it('accepts a negative award', async () => {
    vi.mocked(dbUpsertMflMovieScore).mockResolvedValue({ success: true });

    const { req, res, statusCalls } = mockReqRes({
      body: { ...award, pointsAwarded: -10 },
    });
    await upsertMflMovieScore(req, res);

    expect(statusCalls).toEqual([200]);
  });

  it('passes scoringId through on the update branch', async () => {
    vi.mocked(dbUpsertMflMovieScore).mockResolvedValue({ success: true });

    const { req, res, statusCalls } = mockReqRes({
      body: { ...award, scoringId: 7 },
    });
    await upsertMflMovieScore(req, res);

    expect(statusCalls).toEqual([200]);
    expect(dbUpsertMflMovieScore).toHaveBeenCalledWith('zulu-dawn', 25, 9001, 7);
  });

  it.each([
    ['a missing film slug', { pointsAwarded: 25, metricId: 9001 }],
    ['a blank film slug', { ...award, filmSlug: '   ' }],
    ['missing points', { filmSlug: 'zulu-dawn', metricId: 9001 }],
    ['fractional points', { ...award, pointsAwarded: 1.5 }],
    ['numeric-string points', { ...award, pointsAwarded: '25' }],
    ['NaN points', { ...award, pointsAwarded: Number.NaN }],
    ['a missing metric id', { filmSlug: 'zulu-dawn', pointsAwarded: 25 }],
    ['a zero metric id', { ...award, metricId: 0 }],
    ['a fractional scoring id', { ...award, scoringId: 1.5 }],
  ])('400s on %s without touching the DB', async (_label, body) => {
    const { req, res, statusCalls } = mockReqRes({ body });
    await upsertMflMovieScore(req, res);

    expect(statusCalls).toEqual([400]);
    expect(dbUpsertMflMovieScore).not.toHaveBeenCalled();
  });

  it('409s on a duplicate film/metric award and names the conflict', async () => {
    vi.mocked(dbUpsertMflMovieScore).mockResolvedValue({
      success: false,
      conflict: true,
      error: 'Film zulu-dawn already has an award for metric 9001.',
    });

    const { req, res, statusCalls, jsonCalls } = mockReqRes({ body: award });
    await upsertMflMovieScore(req, res);

    expect(statusCalls).toEqual([409]);
    expect(jsonCalls[0]).toEqual({
      error: 'Film zulu-dawn already has an award for metric 9001.',
    });
  });

  it('500s on any other DB failure', async () => {
    vi.mocked(dbUpsertMflMovieScore).mockResolvedValue({
      success: false,
      error: 'boom',
    });

    const { req, res, statusCalls } = mockReqRes({ body: award });
    await upsertMflMovieScore(req, res);

    expect(statusCalls).toEqual([500]);
  });
});

describe('MFL member picks', () => {
  const AUTH = { user: { id: 'auth-uuid' } };
  const body = { filmSlugs: ['anora', 'hamnet'] };

  const linked = () =>
    vi.mocked(dbResolveLbusername).mockResolvedValue({
      success: true,
      data: 'rooney',
    });

  it('401s when the request carries no authenticated user', async () => {
    const { req, res, statusCalls } = mockReqRes({ body });
    await replaceMflUserPicks(req, res);

    expect(statusCalls).toEqual([401]);
    expect(dbReplaceMflUserPicks).not.toHaveBeenCalled();
  });

  // Reachable: signup makes lbusername optional.
  it('409s when the account has no Letterboxd username linked', async () => {
    vi.mocked(dbResolveLbusername).mockResolvedValue({ success: true, data: null });

    const { req, res, statusCalls, jsonCalls } = mockReqRes({ ...AUTH, body });
    await replaceMflUserPicks(req, res);

    expect(statusCalls).toEqual([409]);
    expect(jsonCalls[0]).toMatchObject({ error: expect.stringContaining('admin') });
    expect(dbReplaceMflUserPicks).not.toHaveBeenCalled();
  });

  it('passes the resolved lbusername, never anything from the request', async () => {
    linked();
    vi.mocked(dbReplaceMflUserPicks).mockResolvedValue({ success: true });

    const { req, res } = mockReqRes({
      ...AUTH,
      body: { ...body, lbusername: 'someone-else' },
    });
    await replaceMflUserPicks(req, res);

    expect(dbReplaceMflUserPicks).toHaveBeenCalledWith('rooney', ['anora', 'hamnet']);
  });

  it.each([
    ['not an array', { filmSlugs: 'anora' }],
    ['a non-string entry', { filmSlugs: ['anora', 7] }],
    ['a duplicate film', { filmSlugs: ['anora', 'anora'] }],
  ])('400s on %s before touching the database', async (_label, bad) => {
    const { req, res, statusCalls } = mockReqRes({ ...AUTH, body: bad });
    await replaceMflUserPicks(req, res);

    expect(statusCalls).toEqual([400]);
    expect(dbResolveLbusername).not.toHaveBeenCalled();
  });

  it('accepts an empty roster, which clears the picks', async () => {
    linked();
    vi.mocked(dbReplaceMflUserPicks).mockResolvedValue({ success: true });

    const { req, res, statusCalls } = mockReqRes({ ...AUTH, body: { filmSlugs: [] } });
    await replaceMflUserPicks(req, res);

    expect(statusCalls).toEqual([]);
    expect(dbReplaceMflUserPicks).toHaveBeenCalledWith('rooney', []);
  });

  // Roster size and spend are Vulture's rules; this cap only stops an absurd
  // payload.
  it('400s a payload beyond the integrity cap', async () => {
    const { req, res, statusCalls } = mockReqRes({
      ...AUTH,
      body: { filmSlugs: Array.from({ length: 21 }, (_, i) => `film-${i}`) },
    });
    await replaceMflUserPicks(req, res);

    expect(statusCalls).toEqual([400]);
  });

  it('404s when a slug is not in the catalogue', async () => {
    linked();
    vi.mocked(dbReplaceMflUserPicks).mockResolvedValue({
      success: false,
      notFound: true,
      error: 'One or more of those films is not in the catalogue.',
    });

    const { req, res, statusCalls } = mockReqRes({ ...AUTH, body });
    await replaceMflUserPicks(req, res);

    expect(statusCalls).toEqual([404]);
  });

  it('returns camelCase picks', async () => {
    linked();
    vi.mocked(dbGetMflUserPicks).mockResolvedValue({
      success: true,
      data: [
        { film_slug: 'anora', title: 'Anora', release_date: '2026-10-18', price: 40 },
      ],
    });

    const { req, res, jsonCalls } = mockReqRes(AUTH);
    await getMflUserPicks(req, res);

    const picks = (jsonCalls[0] as { data: Record<string, unknown>[] }).data;
    expect(Object.keys(picks[0]!).sort()).toEqual([
      'filmSlug',
      'price',
      'releaseDate',
      'title',
    ]);
  });
});
