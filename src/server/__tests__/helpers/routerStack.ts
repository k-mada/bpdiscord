import type { Router } from "express";

export interface RouteStack {
  method: string;
  path: string;
  /** Router-level first, then route-level, by function name. */
  middleware: string[];
}

/**
 * Express internals, written against 4.21.2. A layer with no `.route` is
 * router.use middleware, so reading route.stack alone makes a router that
 * calls router.use(authenticateToken) look unauthenticated.
 */
export function routeStacks(router: Router): RouteStack[] {
  interface Layer {
    name: string;
    route?: {
      path: string;
      methods: Record<string, boolean>;
      stack: { name: string }[];
    };
  }

  const layers = (router as unknown as { stack: Layer[] }).stack;
  const routerLevel: string[] = [];
  const routes: RouteStack[] = [];

  for (const layer of layers) {
    if (!layer.route) {
      routerLevel.push(layer.name);
      continue;
    }
    const method = Object.keys(layer.route.methods)[0]?.toUpperCase() ?? "";
    routes.push({
      method,
      path: layer.route.path,
      middleware: [...routerLevel, ...layer.route.stack.map((s) => s.name)],
    });
  }

  return routes;
}
