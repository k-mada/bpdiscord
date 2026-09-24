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
  dbGetMFLLeaderboard: vi.fn(),
  dbGetMFLUserScores: vi.fn(),
  dbGetMFLScoringMetrics: vi.fn(),
  dbGetMflMovieScore: vi.fn(),
  dbUpsertMflMovieScore: vi.fn(),
  dbDeleteMflMovieScore: vi.fn(),
  dbResolveLbusername: vi.fn(),
  dbGetUserRosters: vi.fn(),
  dbGetRosterOwner: vi.fn(),
  dbGetRosterPicks: vi.fn(),
  dbGetRosterView: vi.fn(),
  dbCreateRoster: vi.fn(),
  dbUpdateRoster: vi.fn(),
  dbDeleteRoster: vi.fn(),
}));

import {
  getMFLMovies,
  getMFLLeaderboard,
  getMFLUserScores,
  upsertMflMovieScore,
  listRosters,
  getRosterPicks,
  getRosterView,
  createRoster,
  updateRoster,
  deleteRoster,
} from '../controllers/mflController';
import {
  dbGetMFLMovies,
  dbGetMFLLeaderboard,
  dbGetMFLUserScores,
  dbUpsertMflMovieScore,
  dbResolveLbusername,
  dbGetUserRosters,
  dbGetRosterOwner,
  dbGetRosterPicks,
  dbGetRosterView,
  dbCreateRoster,
  dbUpdateRoster,
  dbDeleteRoster,
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

describe('getMFLLeaderboard', () => {
  const rows = (
    entries: Array<[string, string | null, number]>,
  ) =>
    entries.map(([lbusername, display_name, total_points], i) => ({
      roster_id: i + 1,
      name: `${lbusername}'s roster`,
      lbusername,
      display_name,
      total_points,
    }));

  it('assigns competition rank: equal totals share a rank and the next total skips', async () => {
    vi.mocked(dbGetMFLLeaderboard).mockResolvedValue({
      success: true,
      data: rows([
        ['alpha', 'Alpha', 50],
        ['bravo', 'Bravo', 30],
        ['charlie', null, 30],
        ['delta', 'Delta', 0],
      ]),
    } as never);

    const { req, res, statusCalls, jsonCalls } = mockReqRes();
    await getMFLLeaderboard(req, res);

    expect(statusCalls).toEqual([]);
    const data = (jsonCalls[0] as { data: Array<Record<string, unknown>> }).data;
    expect(data.map((r) => [r.lbusername, r.rank, r.totalPoints])).toEqual([
      ['alpha', 1, 50],
      ['bravo', 2, 30],
      ['charlie', 2, 30],
      ['delta', 4, 0],
    ]);
  });

  it('renames every column and carries a null display name through', async () => {
    vi.mocked(dbGetMFLLeaderboard).mockResolvedValue({
      success: true,
      data: rows([['charlie', null, 10]]),
    } as never);

    const { req, res, jsonCalls } = mockReqRes();
    await getMFLLeaderboard(req, res);

    const [entry] = (jsonCalls[0] as { data: Record<string, unknown>[] }).data;
    expect(entry).toEqual({
      rank: 1,
      rosterId: 1,
      name: "charlie's roster",
      lbusername: 'charlie',
      displayName: null,
      totalPoints: 10,
    });
  });

  it('returns an empty list rather than failing when nobody has picks', async () => {
    vi.mocked(dbGetMFLLeaderboard).mockResolvedValue({
      success: true,
      data: [],
    } as never);

    const { req, res, statusCalls, jsonCalls } = mockReqRes();
    await getMFLLeaderboard(req, res);

    expect(statusCalls).toEqual([]);
    expect(jsonCalls[0]).toMatchObject({ data: [] });
  });

  it('500s when the query fails', async () => {
    vi.mocked(dbGetMFLLeaderboard).mockResolvedValue({
      success: false,
      error: 'boom',
    } as never);

    const { req, res, statusCalls } = mockReqRes();
    await getMFLLeaderboard(req, res);

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

describe('getRosterView (public)', () => {
  const view = {
    roster_id: 7,
    name: 'My Movie Picks',
    lbusername: 'rooney',
    display_name: 'Rooney',
    total_points: 55,
    picks: [
      { film_slug: 'anora', title: 'Anora', release_date: '2026-10-18', price: 40, total_points: 30 },
      { film_slug: 'hamnet', title: 'Hamnet', release_date: null, price: 25, total_points: 25 },
    ],
  };

  it('returns the roster with camelCase picks and no auth required', async () => {
    vi.mocked(dbGetRosterView).mockResolvedValue({ success: true, data: view } as never);

    const { req, res, statusCalls, jsonCalls } = mockReqRes({ params: { rosterId: '7' } });
    await getRosterView(req, res);

    expect(statusCalls).toEqual([]);
    expect(dbGetRosterView).toHaveBeenCalledWith(7);
    expect(jsonCalls[0]).toMatchObject({
      data: {
        rosterId: 7,
        name: 'My Movie Picks',
        lbusername: 'rooney',
        displayName: 'Rooney',
        totalPoints: 55,
        picks: [
          { filmSlug: 'anora', title: 'Anora', releaseDate: '2026-10-18', price: 40, totalPoints: 30 },
          { filmSlug: 'hamnet', title: 'Hamnet', releaseDate: null, price: 25, totalPoints: 25 },
        ],
      },
    });
  });

  it('emits exactly the camelCase pick keys the client expects', async () => {
    vi.mocked(dbGetRosterView).mockResolvedValue({ success: true, data: view } as never);

    const { req, res, jsonCalls } = mockReqRes({ params: { rosterId: '7' } });
    await getRosterView(req, res);

    const [pick] = (jsonCalls[0] as { data: { picks: Record<string, unknown>[] } }).data.picks;
    expect(Object.keys(pick).sort()).toEqual([
      'filmSlug',
      'price',
      'releaseDate',
      'title',
      'totalPoints',
    ]);
  });

  it('404s when the roster does not exist', async () => {
    vi.mocked(dbGetRosterView).mockResolvedValue({ success: true, data: null } as never);

    const { req, res, statusCalls } = mockReqRes({ params: { rosterId: '999' } });
    await getRosterView(req, res);

    expect(statusCalls).toEqual([404]);
  });

  it('500s when the query fails', async () => {
    vi.mocked(dbGetRosterView).mockResolvedValue({ success: false, error: 'boom' } as never);

    const { req, res, statusCalls } = mockReqRes({ params: { rosterId: '7' } });
    await getRosterView(req, res);

    expect(statusCalls).toEqual([500]);
  });
});

describe('MFL rosters', () => {
  const AUTH = { user: { id: 'auth-uuid' } };

  const linked = () =>
    vi.mocked(dbResolveLbusername).mockResolvedValue({
      success: true,
      data: 'rooney',
    });
  const owns = () =>
    vi.mocked(dbGetRosterOwner).mockResolvedValue({ success: true, data: 'rooney' });

  describe('createRoster', () => {
    const body = { name: 'My Movie Picks', filmSlugs: ['anora', 'hamnet'] };

    it('401s when the request carries no authenticated user', async () => {
      const { req, res, statusCalls } = mockReqRes({ body });
      await createRoster(req, res);

      expect(statusCalls).toEqual([401]);
      expect(dbCreateRoster).not.toHaveBeenCalled();
    });

    // Reachable: signup makes lbusername optional.
    it('409s when the account has no Letterboxd username linked', async () => {
      vi.mocked(dbResolveLbusername).mockResolvedValue({ success: true, data: null });

      const { req, res, statusCalls, jsonCalls } = mockReqRes({ ...AUTH, body });
      await createRoster(req, res);

      expect(statusCalls).toEqual([409]);
      expect(jsonCalls[0]).toMatchObject({ error: expect.stringContaining('admin') });
      expect(dbCreateRoster).not.toHaveBeenCalled();
    });

    it('passes the resolved lbusername, never anything from the request', async () => {
      linked();
      vi.mocked(dbCreateRoster).mockResolvedValue({ success: true, data: 5 });

      const { req, res, statusCalls, jsonCalls } = mockReqRes({
        ...AUTH,
        body: { ...body, lbusername: 'someone-else' },
      });
      await createRoster(req, res);

      expect(statusCalls).toEqual([201]);
      expect(jsonCalls[0]).toMatchObject({ data: { rosterId: 5 } });
      expect(dbCreateRoster).toHaveBeenCalledWith('rooney', 'My Movie Picks', ['anora', 'hamnet'], 10);
    });

    it('trims the roster name', async () => {
      linked();
      vi.mocked(dbCreateRoster).mockResolvedValue({ success: true, data: 1 });

      const { req, res } = mockReqRes({ ...AUTH, body: { ...body, name: '  Padded  ' } });
      await createRoster(req, res);

      expect(dbCreateRoster).toHaveBeenCalledWith('rooney', 'Padded', ['anora', 'hamnet'], 10);
    });

    it('defaults filmSlugs to an empty roster when omitted', async () => {
      linked();
      vi.mocked(dbCreateRoster).mockResolvedValue({ success: true, data: 1 });

      const { req, res, statusCalls } = mockReqRes({ ...AUTH, body: { name: 'Empty' } });
      await createRoster(req, res);

      expect(statusCalls).toEqual([201]);
      expect(dbCreateRoster).toHaveBeenCalledWith('rooney', 'Empty', [], 10);
    });

    it.each([
      ['a missing name', { filmSlugs: ['anora'] }],
      ['a blank name', { name: '   ', filmSlugs: ['anora'] }],
      ['a non-string name', { name: 7, filmSlugs: ['anora'] }],
      ['an over-long name', { name: 'x'.repeat(81), filmSlugs: ['anora'] }],
      ['filmSlugs not an array', { name: 'A', filmSlugs: 'anora' }],
      ['a non-string entry', { name: 'A', filmSlugs: ['anora', 7] }],
      ['a duplicate film', { name: 'A', filmSlugs: ['anora', 'anora'] }],
      ['a payload beyond the integrity cap', {
        name: 'A',
        filmSlugs: Array.from({ length: 21 }, (_, i) => `film-${i}`),
      }],
    ])('400s on %s before touching the database', async (_label, bad) => {
      const { req, res, statusCalls } = mockReqRes({ ...AUTH, body: bad });
      await createRoster(req, res);

      expect(statusCalls).toEqual([400]);
      expect(dbResolveLbusername).not.toHaveBeenCalled();
    });

    it('409s on a duplicate roster name', async () => {
      linked();
      vi.mocked(dbCreateRoster).mockResolvedValue({
        success: false,
        conflict: true,
        error: 'You already have a roster with that name.',
      });

      const { req, res, statusCalls } = mockReqRes({ ...AUTH, body });
      await createRoster(req, res);

      expect(statusCalls).toEqual([409]);
    });

    it('409s when the per-user roster cap is reached', async () => {
      linked();
      vi.mocked(dbCreateRoster).mockResolvedValue({
        success: false,
        limitReached: true,
        error: 'You cannot have more than 10 rosters.',
      });

      const { req, res, statusCalls, jsonCalls } = mockReqRes({ ...AUTH, body });
      await createRoster(req, res);

      expect(statusCalls).toEqual([409]);
      expect(jsonCalls[0]).toMatchObject({ error: expect.stringContaining('10 rosters') });
    });

    it('404s when a slug is not in the catalogue', async () => {
      linked();
      vi.mocked(dbCreateRoster).mockResolvedValue({
        success: false,
        notFound: true,
        error: 'One or more of those films is not in the catalogue.',
      });

      const { req, res, statusCalls } = mockReqRes({ ...AUTH, body });
      await createRoster(req, res);

      expect(statusCalls).toEqual([404]);
    });
  });

  describe('updateRoster', () => {
    const params = { rosterId: '3' };

    it('404s a roster the caller does not own, without writing', async () => {
      linked();
      vi.mocked(dbGetRosterOwner).mockResolvedValue({ success: true, data: 'someone-else' });

      const { req, res, statusCalls } = mockReqRes({
        ...AUTH,
        params,
        body: { filmSlugs: ['anora'] },
      });
      await updateRoster(req, res);

      expect(statusCalls).toEqual([404]);
      expect(dbUpdateRoster).not.toHaveBeenCalled();
    });

    it('404s a roster that does not exist', async () => {
      linked();
      vi.mocked(dbGetRosterOwner).mockResolvedValue({ success: true, data: null });

      const { req, res, statusCalls } = mockReqRes({
        ...AUTH,
        params,
        body: { filmSlugs: ['anora'] },
      });
      await updateRoster(req, res);

      expect(statusCalls).toEqual([404]);
      expect(dbUpdateRoster).not.toHaveBeenCalled();
    });

    it('replaces picks on an owned roster', async () => {
      linked();
      owns();
      vi.mocked(dbUpdateRoster).mockResolvedValue({ success: true });

      const { req, res, statusCalls } = mockReqRes({
        ...AUTH,
        params,
        body: { filmSlugs: ['anora', 'hamnet'] },
      });
      await updateRoster(req, res);

      expect(statusCalls).toEqual([]);
      expect(dbUpdateRoster).toHaveBeenCalledWith(3, { filmSlugs: ['anora', 'hamnet'] });
    });

    it('renames without touching picks', async () => {
      linked();
      owns();
      vi.mocked(dbUpdateRoster).mockResolvedValue({ success: true });

      const { req, res } = mockReqRes({ ...AUTH, params, body: { name: 'Renamed' } });
      await updateRoster(req, res);

      expect(dbUpdateRoster).toHaveBeenCalledWith(3, { name: 'Renamed' });
    });

    it('accepts an empty roster, which clears the picks', async () => {
      linked();
      owns();
      vi.mocked(dbUpdateRoster).mockResolvedValue({ success: true });

      const { req, res, statusCalls } = mockReqRes({ ...AUTH, params, body: { filmSlugs: [] } });
      await updateRoster(req, res);

      expect(statusCalls).toEqual([]);
      expect(dbUpdateRoster).toHaveBeenCalledWith(3, { filmSlugs: [] });
    });

    it('400s when nothing is provided to change', async () => {
      linked();
      owns();

      const { req, res, statusCalls } = mockReqRes({ ...AUTH, params, body: {} });
      await updateRoster(req, res);

      expect(statusCalls).toEqual([400]);
      expect(dbUpdateRoster).not.toHaveBeenCalled();
    });

    it('409s on a duplicate roster name', async () => {
      linked();
      owns();
      vi.mocked(dbUpdateRoster).mockResolvedValue({
        success: false,
        conflict: true,
        error: 'You already have a roster with that name.',
      });

      const { req, res, statusCalls } = mockReqRes({ ...AUTH, params, body: { name: 'Dup' } });
      await updateRoster(req, res);

      expect(statusCalls).toEqual([409]);
    });
  });

  describe('deleteRoster', () => {
    it('404s a roster the caller does not own, without deleting', async () => {
      linked();
      vi.mocked(dbGetRosterOwner).mockResolvedValue({ success: true, data: 'someone-else' });

      const { req, res, statusCalls } = mockReqRes({ ...AUTH, params: { rosterId: '3' } });
      await deleteRoster(req, res);

      expect(statusCalls).toEqual([404]);
      expect(dbDeleteRoster).not.toHaveBeenCalled();
    });

    it('deletes an owned roster', async () => {
      linked();
      owns();
      vi.mocked(dbDeleteRoster).mockResolvedValue({ success: true });

      const { req, res, statusCalls } = mockReqRes({ ...AUTH, params: { rosterId: '3' } });
      await deleteRoster(req, res);

      expect(statusCalls).toEqual([]);
      expect(dbDeleteRoster).toHaveBeenCalledWith(3);
    });
  });

  describe('listRosters', () => {
    it('returns camelCase rosters for the caller', async () => {
      linked();
      vi.mocked(dbGetUserRosters).mockResolvedValue({
        success: true,
        data: [{ roster_id: 1, name: 'A' }, { roster_id: 2, name: 'B' }],
      });

      const { req, res, jsonCalls } = mockReqRes(AUTH);
      await listRosters(req, res);

      expect(jsonCalls[0]).toMatchObject({
        data: [{ rosterId: 1, name: 'A' }, { rosterId: 2, name: 'B' }],
      });
      expect(dbGetUserRosters).toHaveBeenCalledWith('rooney');
    });
  });

  describe('getRosterPicks', () => {
    it('404s a roster the caller does not own', async () => {
      linked();
      vi.mocked(dbGetRosterOwner).mockResolvedValue({ success: true, data: 'someone-else' });

      const { req, res, statusCalls } = mockReqRes({ ...AUTH, params: { rosterId: '3' } });
      await getRosterPicks(req, res);

      expect(statusCalls).toEqual([404]);
      expect(dbGetRosterPicks).not.toHaveBeenCalled();
    });

    it('returns camelCase picks for an owned roster', async () => {
      linked();
      owns();
      vi.mocked(dbGetRosterPicks).mockResolvedValue({
        success: true,
        data: [
          { film_slug: 'anora', title: 'Anora', release_date: '2026-10-18', price: 40 },
        ],
      });

      const { req, res, jsonCalls } = mockReqRes({ ...AUTH, params: { rosterId: '3' } });
      await getRosterPicks(req, res);

      const picks = (jsonCalls[0] as { data: Record<string, unknown>[] }).data;
      expect(Object.keys(picks[0]!).sort()).toEqual([
        'filmSlug',
        'price',
        'releaseDate',
        'title',
      ]);
      expect(dbGetRosterPicks).toHaveBeenCalledWith(3);
    });
  });
});
