import { vi, describe, it, expect, beforeEach } from 'vitest';
import { mockReqRes } from "./helpers/mockReqRes";

// Branch logic only; the queries are covered in dataController.test.ts.
vi.mock('../controllers/dataController', () => ({
  dbGetMovieSwap: vi.fn(),
  dbGetNonDiscordUsernames: vi.fn(),
}));

import { getMovieSwap } from '../controllers/comparisonController';
import {
  dbGetMovieSwap,
  dbGetNonDiscordUsernames,
} from '../controllers/dataController';

const swap = { recsForUserA: [], recsForUserB: [] };

describe('getMovieSwap', () => {
  beforeEach(() => {
    vi.mocked(dbGetMovieSwap).mockReset();
    vi.mocked(dbGetMovieSwap).mockResolvedValue({ success: true, data: swap });
    vi.mocked(dbGetNonDiscordUsernames).mockReset();
    vi.mocked(dbGetNonDiscordUsernames).mockResolvedValue({ success: true, data: [] });
  });

  it('returns the swap between two Discord members', async () => {
    const { req, res, statusCalls, jsonCalls } = mockReqRes({
      query: { userA: 'alice', userB: 'bob' },
    });
    await getMovieSwap(req, res);

    expect(statusCalls).toEqual([]);
    expect(jsonCalls[0]).toMatchObject({ data: swap });
  });

  it('refuses a non-Discord user with 400 and skips the swap query', async () => {
    vi.mocked(dbGetNonDiscordUsernames).mockResolvedValue({
      success: true,
      data: ['guest'],
    });
    const { req, res, statusCalls } = mockReqRes({
      query: { userA: 'alice', userB: 'guest' },
    });
    await getMovieSwap(req, res);

    expect(statusCalls).toEqual([400]);
    expect(dbGetMovieSwap).not.toHaveBeenCalled();
  });

  it('checks the lowercased usernames', async () => {
    const { req, res } = mockReqRes({ query: { userA: 'Alice', userB: 'BOB' } });
    await getMovieSwap(req, res);

    expect(dbGetNonDiscordUsernames).toHaveBeenCalledWith(['alice', 'bob']);
  });

  it('returns 500 when the Discord check fails', async () => {
    vi.mocked(dbGetNonDiscordUsernames).mockResolvedValue({
      success: false,
      error: 'db down',
    });
    const { req, res, statusCalls } = mockReqRes({
      query: { userA: 'alice', userB: 'bob' },
    });
    await getMovieSwap(req, res);

    expect(statusCalls).toEqual([500]);
    expect(dbGetMovieSwap).not.toHaveBeenCalled();
  });
});
