import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module before importing the utilities
vi.mock("../db", () => ({
  db: {
    transaction: vi.fn(),
  },
}));

import { db } from "../db";
import {
  dbOperation,
  dbQueryWithCount,
  dbMutation,
  dbTransaction,
} from "../db/utils";

describe("dbOperation", () => {
  it("returns success with data on successful operation", async () => {
    const result = await dbOperation(async () => ({ id: 1, name: "test" }));

    expect(result).toEqual({
      success: true,
      data: { id: 1, name: "test" },
    });
  });

  it("returns success with null data", async () => {
    const result = await dbOperation(async () => null);

    expect(result).toEqual({
      success: true,
      data: null,
    });
  });

  it("returns failure with error message on thrown Error", async () => {
    const result = await dbOperation(async () => {
      throw new Error("Connection refused");
    });

    expect(result).toEqual({
      success: false,
      error: "Connection refused",
    });
  });

  it("returns failure with generic message on non-Error throw", async () => {
    const result = await dbOperation(async () => {
      throw "string error";
    });

    expect(result).toEqual({
      success: false,
      error: "Unknown database error",
    });
  });
});

describe("dbQueryWithCount", () => {
  it("returns success with data and count", async () => {
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const result = await dbQueryWithCount(async () => items);

    expect(result).toEqual({
      success: true,
      data: items,
      count: 3,
    });
  });

  it("returns count of 0 for empty array", async () => {
    const result = await dbQueryWithCount(async () => []);

    expect(result).toEqual({
      success: true,
      data: [],
      count: 0,
    });
  });

  it("returns failure with error on throw", async () => {
    const result = await dbQueryWithCount(async () => {
      throw new Error("Query timeout");
    });

    expect(result).toEqual({
      success: false,
      error: "Query timeout",
    });
  });
});

describe("dbMutation", () => {
  it("returns success without data on successful mutation", async () => {
    const result = await dbMutation(async () => {
      // simulate a void mutation
    });

    expect(result).toEqual({ success: true });
    expect(result.data).toBeUndefined();
  });

  it("returns failure with error on throw", async () => {
    const result = await dbMutation(async () => {
      throw new Error("Foreign key constraint violation");
    });

    expect(result).toEqual({
      success: false,
      error: "Foreign key constraint violation",
    });
  });
});

describe("dbTransaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls db.transaction and returns success", async () => {
    vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
      await fn({} as any); // pass a mock transaction object
    });

    const operation = vi.fn();
    const result = await dbTransaction(operation);

    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ success: true });
  });

  it("returns failure when transaction throws", async () => {
    vi.mocked(db.transaction).mockRejectedValue(
      new Error("Deadlock detected")
    );

    const result = await dbTransaction(async () => {});

    expect(result).toEqual({
      success: false,
      error: "Deadlock detected",
    });
  });

  it("returns failure when operation inside transaction throws", async () => {
    vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
      await fn({} as any);
    });

    const result = await dbTransaction(async () => {
      throw new Error("Insert failed");
    });

    expect(result).toEqual({
      success: false,
      error: "Insert failed",
    });
  });
});
