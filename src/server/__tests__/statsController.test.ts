import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

// Hoisted mock so the controller picks up the stubbed data layer at import time.
// We only exercise getTopFilmsByYear's branch logic (param presence → year filter
// + threshold selection + response shape), not the DB query itself — that's
// covered by dataController.test.ts.
vi.mock('../controllers/dataController', () => ({
  dbGetTopUserFilms: vi.fn(),
  TopUserFilmsOrder: { HighestRated: 'highest_rated', MostWatched: 'most_watched' },
}));

import { getTopFilmsByYear } from '../controllers/statsController';
import { dbGetTopUserFilms, TopUserFilmsOrder } from '../controllers/dataController';

interface MockedReqRes {
  req: Request;
  res: Response;
  statusCalls: number[];
  jsonCalls: unknown[];
}

function mockReqRes(params: Record<string, string>): MockedReqRes {
  const statusCalls: number[] = [];
  const jsonCalls: unknown[] = [];
  const res = {} as { status: (c: number) => unknown; json: (p: unknown) => unknown };
  res.status = (code: number) => {
    statusCalls.push(code);
    return res;
  };
  res.json = (payload: unknown) => {
    jsonCalls.push(payload);
    return res;
  };
  return {
    req: { params } as unknown as Request,
    res: res as unknown as Response,
    statusCalls,
    jsonCalls,
  };
}

const okRows = { success: true, data: [] as unknown[] };

describe('getTopFilmsByYear', () => {
  beforeEach(() => {
    vi.mocked(dbGetTopUserFilms).mockReset();
    vi.mocked(dbGetTopUserFilms).mockResolvedValue(okRows as never);
  });

  it('defaults to all-time (no year filter, 20-rating bar) when no :year param', async () => {
    const { req, res, jsonCalls } = mockReqRes({});
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
    const { req, res, jsonCalls } = mockReqRes({ year: '2021' });
    await getTopFilmsByYear(req, res);

    const calls = vi.mocked(dbGetTopUserFilms).mock.calls.map((c) => c[0]);
    const rated = calls.find((c) => c?.orderBy === TopUserFilmsOrder.HighestRated);
    const watched = calls.find((c) => c?.orderBy === TopUserFilmsOrder.MostWatched);

    expect(rated).toMatchObject({ year: 2021, minRatings: 5, limit: 25 });
    expect(watched).toMatchObject({ year: 2021, limit: 25 });
    expect(jsonCalls[0]).toMatchObject({ success: true, data: { year: 2021 } });
  });

  it('400s on an out-of-range year and never touches the DB', async () => {
    const { req, res, statusCalls, jsonCalls } = mockReqRes({ year: '1700' });
    await getTopFilmsByYear(req, res);

    expect(statusCalls[0]).toBe(400);
    expect(jsonCalls[0]).toMatchObject({ success: false });
    expect(dbGetTopUserFilms).not.toHaveBeenCalled();
  });

  it('400s on a non-numeric year', async () => {
    const { req, res, statusCalls } = mockReqRes({ year: 'abc' });
    await getTopFilmsByYear(req, res);

    expect(statusCalls[0]).toBe(400);
    expect(dbGetTopUserFilms).not.toHaveBeenCalled();
  });
});
