import { vi, describe, it, expect, beforeEach } from 'vitest';
import { mockReqRes } from "./helpers/mockReqRes";

// Hoisted so the controller picks up the stub at import time. Covers only
// branch logic; the DB query itself is dataController.test.ts's job.
vi.mock('../controllers/dataController', () => ({
  dbGetTopUserFilms: vi.fn(),
  dbGetRatingDifferentialExtremes: vi.fn(),
  TopUserFilmsOrder: { HighestRated: 'highest_rated', MostWatched: 'most_watched' },
}));

import { getTopFilmsByYear, getRatingDifferential } from '../controllers/statsController';
import {
  dbGetTopUserFilms,
  dbGetRatingDifferentialExtremes,
  TopUserFilmsOrder,
} from '../controllers/dataController';



const okRows = { success: true, data: [] as unknown[] };

describe('getTopFilmsByYear', () => {
  beforeEach(() => {
    vi.mocked(dbGetTopUserFilms).mockReset();
    vi.mocked(dbGetTopUserFilms).mockResolvedValue(okRows as never);
  });

  it('defaults to all-time (no year filter, 20-rating bar) when no :year param', async () => {
    const { req, res, jsonCalls } = mockReqRes({ params: {} });
    await getTopFilmsByYear(req, res);

    const calls = vi.mocked(dbGetTopUserFilms).mock.calls.map((c) => c[0]);
    const rated = calls.find((c) => c?.orderBy === TopUserFilmsOrder.HighestRated);
    const watched = calls.find((c) => c?.orderBy === TopUserFilmsOrder.MostWatched);

    expect(rated).toMatchObject({ minRatings: 20 });
    expect(rated).not.toHaveProperty('year');
    expect(watched).toMatchObject({ limit: 24 });
    expect(watched).not.toHaveProperty('year');
    expect(jsonCalls[0]).toMatchObject({ success: true, data: { year: null } });
  });

  it('scopes to the release year with the looser 5-rating bar when :year is present', async () => {
    const { req, res, jsonCalls } = mockReqRes({ params: { year: '2021' } });
    await getTopFilmsByYear(req, res);

    const calls = vi.mocked(dbGetTopUserFilms).mock.calls.map((c) => c[0]);
    const rated = calls.find((c) => c?.orderBy === TopUserFilmsOrder.HighestRated);
    const watched = calls.find((c) => c?.orderBy === TopUserFilmsOrder.MostWatched);

    expect(rated).toMatchObject({ year: 2021, minRatings: 5, limit: 25 });
    expect(watched).toMatchObject({ year: 2021, limit: 25 });
    expect(jsonCalls[0]).toMatchObject({ success: true, data: { year: 2021 } });
  });

  it('400s on an out-of-range year and never touches the DB', async () => {
    const { req, res, statusCalls, jsonCalls } = mockReqRes({ params: { year: '1700' } });
    await getTopFilmsByYear(req, res);

    expect(statusCalls[0]).toBe(400);
    expect(jsonCalls[0]).toMatchObject({ success: false });
    expect(dbGetTopUserFilms).not.toHaveBeenCalled();
  });

  it('400s on a non-numeric year', async () => {
    const { req, res, statusCalls } = mockReqRes({ params: { year: 'abc' } });
    await getTopFilmsByYear(req, res);

    expect(statusCalls[0]).toBe(400);
    expect(dbGetTopUserFilms).not.toHaveBeenCalled();
  });
});

describe('getRatingDifferential', () => {
  beforeEach(() => {
    vi.mocked(dbGetRatingDifferentialExtremes).mockReset();
    vi.mocked(dbGetRatingDifferentialExtremes).mockResolvedValue({
      success: true,
      data: { over: [], under: [] },
    } as never);
  });

  it('defaults to all-time with the 20-rating bar when no :year param', async () => {
    const { req, res, jsonCalls } = mockReqRes({ params: {} });
    await getRatingDifferential(req, res);

    const opts = vi.mocked(dbGetRatingDifferentialExtremes).mock.calls[0]?.[0];
    expect(opts).toMatchObject({ minRatings: 20 });
    expect(opts).not.toHaveProperty('year');
    expect(jsonCalls[0]).toMatchObject({
      success: true,
      data: { year: null, over: [], under: [] },
    });
  });

  it('scopes to the release year with the looser 5-rating bar when :year is present', async () => {
    const { req, res, jsonCalls } = mockReqRes({ params: { year: '2021' } });
    await getRatingDifferential(req, res);

    const opts = vi.mocked(dbGetRatingDifferentialExtremes).mock.calls[0]?.[0];
    expect(opts).toMatchObject({ year: 2021, minRatings: 5 });
    expect(jsonCalls[0]).toMatchObject({ success: true, data: { year: 2021 } });
  });

  it('400s on an out-of-range year and never touches the DB', async () => {
    const { req, res, statusCalls, jsonCalls } = mockReqRes({ params: { year: '1700' } });
    await getRatingDifferential(req, res);

    expect(statusCalls[0]).toBe(400);
    expect(jsonCalls[0]).toMatchObject({ success: false });
    expect(dbGetRatingDifferentialExtremes).not.toHaveBeenCalled();
  });

  it('surfaces a DB failure as { success: false }', async () => {
    vi.mocked(dbGetRatingDifferentialExtremes).mockResolvedValue({
      success: false,
      error: 'boom',
    } as never);
    const { req, res, jsonCalls } = mockReqRes({ params: {} });
    await getRatingDifferential(req, res);

    expect(jsonCalls[0]).toMatchObject({ success: false, error: 'boom' });
  });
});
