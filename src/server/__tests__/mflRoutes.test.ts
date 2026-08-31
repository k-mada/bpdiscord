import mflRoutes from "../routes/mflRoutes";
import { routeStacks } from "./helpers/routerStack";

// The bug this guards was an entire router mounted with no auth. Asserting the
// middleware NAMES is the only way to catch that without a network call.
describe("mflRoutes wiring", () => {
  const routes = routeStacks(mflRoutes);

  it("exposes exactly the routes it means to", () => {
    expect(routes.map((r) => `${r.method} ${r.path}`).sort()).toEqual([
      "DELETE /admin/movie-score/:scoringId",
      "GET /movie-score/:filmSlug",
      "GET /movies",
      "GET /scoring-metrics",
      "GET /user-scores/:username",
      "POST /admin/movie-score",
    ]);
  });

  it.each([
    ["POST", "/admin/movie-score"],
    ["DELETE", "/admin/movie-score/:scoringId"],
  ])(
    "gates %s %s behind authenticateToken then authorizeAdmin",
    (method, path) => {
      const route = routes.find((r) => r.method === method && r.path === path)!;

      expect(route.middleware).toContain("authenticateToken");
      expect(route.middleware).toContain("authorizeAdmin");
      // Order matters: authorizeAdmin reads req.user, which only authenticateToken sets.
      expect(route.middleware.indexOf("authenticateToken")).toBeLessThan(
        route.middleware.indexOf("authorizeAdmin"),
      );
    },
  );

  // Locking these down would break the public MFL dashboard and scoring page.
  it("leaves every read public", () => {
    for (const route of routes.filter((r) => r.method === "GET")) {
      expect(route.middleware).not.toContain("authenticateToken");
      expect(route.middleware).not.toContain("authorizeAdmin");
    }
  });
});
