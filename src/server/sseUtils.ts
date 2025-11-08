import { Response } from "express";
import { EventEmitter } from "events";
import { BROWSER_CONFIG } from "./constants";

/**
 * SSE Utilities for Server-Sent Events streams
 * Provides reusable functions for managing SSE connections
 */

export interface SSEContext {
  progressEmitter: EventEmitter;
  isCompleted: { value: boolean };
  heartbeatInterval: NodeJS.Timeout;
  cleanupFn: () => void;
}

/**
 * Initialize SSE response headers
 */
export function setupSSEHeaders(res: Response): void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Cache-Control",
  });
}

/**
 * Write data to SSE stream with error handling
 */
export function writeSSEData(res: Response, data: any): void {
  if (!res.headersSent || !res.writable) return;

  try {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  } catch (writeError) {
    console.error("Error writing SSE data:", writeError);
  }
}

/**
 * Create cleanup function for SSE context
 */
function createCleanupFunction(
  res: Response,
  isCompleted: { value: boolean },
  heartbeatInterval: NodeJS.Timeout | undefined,
  progressEmitter: EventEmitter
): () => void {
  return () => {
    if (isCompleted.value) return;
    isCompleted.value = true;

    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }

    progressEmitter.removeAllListeners();

    if (!res.headersSent && res.writable) {
      try {
        res.end();
      } catch (endError) {
        console.error("Error ending SSE response:", endError);
      }
    }
  };
}

/**
 * Attach standard SSE event listeners (progress, error, complete)
 */
function attachSSEListeners(
  progressEmitter: EventEmitter,
  res: Response,
  isCompleted: { value: boolean },
  cleanupFn: () => void
): void {
  progressEmitter.on("progress", (data) => {
    writeSSEData(res, data);
  });

  progressEmitter.on("error", (error) => {
    if (isCompleted.value) return;
    writeSSEData(res, {
      type: "error",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
    cleanupFn();
  });

  progressEmitter.on("complete", (data) => {
    if (isCompleted.value) return;
    writeSSEData(res, {
      type: "complete",
      data,
      timestamp: new Date().toISOString(),
    });
    cleanupFn();
  });
}

/**
 * Create heartbeat interval to keep SSE connection alive
 */
function createHeartbeat(
  res: Response,
  isCompleted: { value: boolean },
  cleanupFn: () => void
): NodeJS.Timeout {
  return setInterval(() => {
    if (isCompleted.value) return;
    try {
      writeSSEData(res, {
        type: "heartbeat",
        timestamp: new Date().toISOString(),
      });
    } catch (writeError) {
      console.error("Error writing heartbeat:", writeError);
      cleanupFn();
    }
  }, BROWSER_CONFIG.SSE_HEARTBEAT_INTERVAL);
}

/**
 * Initialize complete SSE context with all necessary setup
 * Returns context object with emitter, cleanup function, and state
 */
export function initializeSSEContext(res: Response): SSEContext {
  setupSSEHeaders(res);

  const progressEmitter = new EventEmitter();
  const isCompleted = { value: false };
  let heartbeatInterval: NodeJS.Timeout;

  // Create cleanup function (needs to be created before listeners)
  const cleanupFn = createCleanupFunction(
    res,
    isCompleted,
    heartbeatInterval!,
    progressEmitter
  );

  // Attach event listeners
  attachSSEListeners(progressEmitter, res, isCompleted, cleanupFn);

  // Start heartbeat
  heartbeatInterval = createHeartbeat(res, isCompleted, cleanupFn);

  return {
    progressEmitter,
    isCompleted,
    heartbeatInterval,
    cleanupFn,
  };
}

/**
 * Handle SSE errors with smart error detection
 */
export function handleSSEError(
  error: unknown,
  username: string,
  progressEmitter: EventEmitter,
  isCompleted: boolean
): void {
  if (isCompleted) return;

  const errorMessage =
    error instanceof Error ? error.message : "Unknown error occurred";

  if (
    errorMessage.includes("Navigation timeout") ||
    errorMessage.includes("TimeoutError")
  ) {
    progressEmitter.emit("error", {
      message:
        "Page loading timeout - the Letterboxd page is taking too long to load. Please try again later.",
      code: "NAVIGATION_TIMEOUT",
      username,
    });
  } else {
    progressEmitter.emit("error", {
      message: errorMessage,
      username,
    });
  }
}

/**
 * Setup production timeout for long-running operations
 * Returns timeout ID that should be cleared on success
 */
export function setupProductionTimeout(
  username: string,
  progressEmitter: EventEmitter
): NodeJS.Timeout {
  return setTimeout(() => {
    console.log(`Production timeout reached for ${username}`);
    progressEmitter.emit("error", {
      message:
        "Operation timeout - the scraping process is taking too long. Please try again later or contact support.",
      code: "PRODUCTION_TIMEOUT",
    });
  }, BROWSER_CONFIG.PRODUCTION_TIMEOUT);
}
