import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

// Hoisted so the controller picks up the stub at import time. Covers only
// branch logic; the DB query itself is dataController.test.ts's job.
vi.mock('../controllers/dataController', () => ({
  dbGetFilmDetail: vi.fn(),
}));

import { getFilmDetail } from '../controllers/filmController';
import { dbGetFilmDetail } from '../controllers/dataController';
import { validateFilmSlug } from '../middleware/validation';
import { handleValidationErrors } from '../middleware/errorHandler';

interface MockedReqRes {
  req: Request;
  res: Response;
  statusCalls: number[];
  jsonCalls: unknown[];
}

function mockReqRes(
  params: Record<string, string>,
  query: Record<string, string> = {},
): MockedReqRes {
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
    req: { params, query } as unknown as Request,
    res: res as unknown as Response,
    statusCalls,
    jsonCalls,
  };
}

const film = { filmSlug: 'heat', title: 'Heat', watchedCount: 3 };

describe('getFilmDetail', () => {
  beforeEach(() => {
    vi.mocked(dbGetFilmDetail).mockReset();
    vi.mocked(dbGetFilmDetail).mockResolvedValue({ success: true, data: film } as never);
  });

  it('returns the film payload', async () => {
    const { req, res, statusCalls, jsonCalls } = mockReqRes({ filmSlug: 'heat' });
    await getFilmDetail(req, res);

    expect(statusCalls).toEqual([]);
    expect(jsonCalls[0]).toMatchObject({ data: film });
  });

  it('defaults to discord-only scoping', async () => {
    const { req, res } = mockReqRes({ filmSlug: 'heat' });
    await getFilmDetail(req, res);

    expect(dbGetFilmDetail).toHaveBeenCalledWith('heat', { includeNonDiscord: false });
  });

  it('threads includeNonDiscord=true through to the query', async () => {
    const { req, res } = mockReqRes({ filmSlug: 'heat' }, { includeNonDiscord: 'true' });
    await getFilmDetail(req, res);

    expect(dbGetFilmDetail).toHaveBeenCalledWith('heat', { includeNonDiscord: true });
  });

  it('404s when the slug resolves to nothing', async () => {
    vi.mocked(dbGetFilmDetail).mockResolvedValue({ success: true, data: null } as never);
    const { req, res, statusCalls } = mockReqRes({ filmSlug: 'ghost' });
    await getFilmDetail(req, res);

    expect(statusCalls).toEqual([404]);
  });

  it('500s when the query fails', async () => {
    vi.mocked(dbGetFilmDetail).mockResolvedValue({ success: false, error: 'db down' } as never);
    const { req, res, statusCalls, jsonCalls } = mockReqRes({ filmSlug: 'heat' });
    await getFilmDetail(req, res);

    expect(statusCalls).toEqual([500]);
    expect(jsonCalls[0]).toMatchObject({ error: 'db down' });
  });

  it('500s when the query throws', async () => {
    vi.mocked(dbGetFilmDetail).mockRejectedValue(new Error('boom'));
    const { req, res, statusCalls } = mockReqRes({ filmSlug: 'heat' });
    await getFilmDetail(req, res);

    expect(statusCalls).toEqual([500]);
  });
});

describe('film slug validation', () => {
  async function runValidation(
    params: Record<string, string>,
    query: Record<string, string> = {},
  ): Promise<{ status: number | null; passed: boolean }> {
    const req = { params, query, body: {}, headers: {}, cookies: {} } as unknown as Request;
    for (const chain of validateFilmSlug) await chain.run(req);

    let status: number | null = null;
    let passed = false;
    const res = {
      status: (code: number) => {
        status = code;
        return res;
      },
      json: () => res,
    };
    handleValidationErrors(req, res as unknown as Response, () => {
      passed = true;
    });
    return { status, passed };
  }

  it('accepts a normal slug', async () => {
    expect(await runValidation({ filmSlug: 'the-departed-2006' })).toMatchObject({ passed: true });
  });

  it('rejects a slug with path or wildcard characters', async () => {
    expect(await runValidation({ filmSlug: '../etc/passwd' })).toMatchObject({ status: 400 });
    expect(await runValidation({ filmSlug: 'a'.repeat(201) })).toMatchObject({ status: 400 });
  });

  it('rejects a non-boolean includeNonDiscord instead of silently reading it as false', async () => {
    expect(
      await runValidation({ filmSlug: 'heat' }, { includeNonDiscord: 'banana' }),
    ).toMatchObject({ status: 400 });
  });

  it('accepts includeNonDiscord=true', async () => {
    expect(
      await runValidation({ filmSlug: 'heat' }, { includeNonDiscord: 'true' }),
    ).toMatchObject({ passed: true });
  });
});
