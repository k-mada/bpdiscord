import fs from "fs";
import path from "path";
import type { Router } from "express";
import { routeStacks } from "./helpers/routerStack";

// bpdiscord-ayy shipped a whole router with no auth, so this inverts it.
// The allowlist is a REVIEW artifact, not a technical control.
const PUBLIC_MUTATIONS = new Set([
  // Cannot require a token: these are how a token is obtained.
  "authRoutes POST /signup",
  "authRoutes POST /login",
  "authRoutes POST /forgot-password",
  // Public reads that take a body rather than a query string. They mutate
  // nothing; the method is wrong, not the authorization.
  "comparisonRoutes POST /user-ratings",
  "comparisonRoutes POST /compare",
  "comparisonRoutes POST /movies-in-common",
]);

const ROUTES_DIR = path.join(__dirname, "..", "routes");
const files = fs
  .readdirSync(ROUTES_DIR)
  .filter((f) => f.endsWith(".ts"))
  .sort();

describe("every mutating route is authenticated", () => {
  const mutations: { id: string; middleware: string[] }[] = [];

  beforeAll(async () => {
    for (const file of files) {
      const mod = await import(path.join(ROUTES_DIR, file));
      const router = mod.default as Router | undefined;
      if (!router || !("stack" in router)) continue;

      for (const route of routeStacks(router)) {
        if (route.method === "GET") continue;
        mutations.push({
          id: `${file.replace(".ts", "")} ${route.method} ${route.path}`,
          middleware: route.middleware,
        });
      }
    }
  });

  // Without this the suite passes vacuously the day an Express upgrade
  // changes router.stack: nothing is found, so nothing is unauthenticated.
  it("actually walked the routers", () => {
    expect(files.length).toBeGreaterThan(5);
    expect(mutations.length).toBeGreaterThan(10);
  });

  it("finds no unauthenticated write outside the allowlist", () => {
    const open = mutations
      .filter((m) => !m.middleware.includes("authenticateToken"))
      .map((m) => m.id)
      .filter((id) => !PUBLIC_MUTATIONS.has(id));

    expect(open).toEqual([]);
  });

  // An allowlist entry that no longer matches a real route is a stale
  // exemption, and the next route to take that path inherits it silently.
  it("has no stale allowlist entries", () => {
    const ids = new Set(mutations.map((m) => m.id));
    expect([...PUBLIC_MUTATIONS].filter((id) => !ids.has(id))).toEqual([]);
  });
});
