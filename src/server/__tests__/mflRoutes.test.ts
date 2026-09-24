import mflRoutes from "../routes/mflRoutes";
import { routeStacks } from "./helpers/routerStack";

// The bug this guards was an entire router mounted with no auth. Asserting the
// middleware NAMES is the only way to catch that without a network call.
describe("mflRoutes wiring", () => {
  const routes = routeStacks(mflRoutes);

  it("exposes exactly the routes it means to", () => {
    expect(routes.map((r) => `${r.method} ${r.path}`).sort()).toEqual([
      "DELETE /admin/movie-score/:scoringId",
      "DELETE /rosters/:rosterId",
      "GET /leaderboard",
      "GET /movie-score/:filmSlug",
      "GET /movies",
      "GET /rosters",
      "GET /rosters/:rosterId",
      "GET /rosters/:rosterId/picks",
      "GET /scoring-metrics",
      "GET /user-scores/:username",
      "POST /admin/movie-score",
      "POST /rosters",
      "PUT /rosters/:rosterId",
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

  // Locking these down would break the public MFL dashboard, scoring page and
  // the read-only roster view. GET /rosters and .../picks are the authed reads.
  it.each([
    "/scoring-metrics",
    "/user-scores/:username",
    "/leaderboard",
    "/movie-score/:filmSlug",
    "/movies",
    "/rosters/:rosterId",
  ])("leaves GET %s public", (path) => {
    const route = routes.find((r) => r.method === "GET" && r.path === path)!;

    expect(route.middleware).not.toContain("authenticateToken");
    expect(route.middleware).not.toContain("authorizeAdmin");
  });

  it.each([
    ["GET", "/rosters"],
    ["POST", "/rosters"],
    ["GET", "/rosters/:rosterId/picks"],
    ["PUT", "/rosters/:rosterId"],
    ["DELETE", "/rosters/:rosterId"],
  ])("gates %s %s behind authenticateToken but not authorizeAdmin", (method, path) => {
    const route = routes.find((r) => r.method === method && r.path === path)!;

    expect(route.middleware).toContain("authenticateToken");
    // A member manages their own rosters; requiring admin would lock everyone out.
    expect(route.middleware).not.toContain("authorizeAdmin");
  });
});
