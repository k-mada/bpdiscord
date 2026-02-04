import { db } from './index';

export type DbResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export type DbResultWithCount<T> = DbResult<T> & {
  count?: number;
};

// Transaction type - matches Drizzle's transaction callback parameter
export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Wraps a database operation with consistent error handling.
 * Eliminates repetitive try/catch blocks across all db functions.
 */
export async function dbOperation<T>(
  operation: () => Promise<T>
): Promise<DbResult<T>> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    console.error('Database operation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
}

/**
 * Wraps a database query that returns an array, includes count in result.
 */
export async function dbQueryWithCount<T>(
  operation: () => Promise<T[]>
): Promise<DbResultWithCount<T[]>> {
  try {
    const data = await operation();
    return { success: true, data, count: data.length };
  } catch (error) {
    console.error('Database operation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
}

/**
 * Wraps a database mutation (insert/update/delete) that doesn't return data.
 */
export async function dbMutation(
  operation: () => Promise<unknown>
): Promise<DbResult<void>> {
  try {
    await operation();
    return { success: true };
  } catch (error) {
    console.error('Database operation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
}

/**
 * Wraps a database mutation in a transaction with consistent error handling.
 * All operations within the callback will be rolled back if any fail.
 */
export async function dbTransaction(
  operation: (tx: Transaction) => Promise<void>
): Promise<DbResult<void>> {
  try {
    await db.transaction(async (tx) => {
      await operation(tx);
    });
    return { success: true };
  } catch (error) {
    console.error('Database transaction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
}
