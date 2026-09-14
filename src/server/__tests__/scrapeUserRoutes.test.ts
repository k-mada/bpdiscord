import scrapeUserRoutes from "../routes/scrapeUserRoutes";
import { routeStacks } from "./helpers/routerStack";

// Every scrape route requires a JWT but NOT admin. Asserting authorizeAdmin is
// ABSENT guards against accidentally locking these behind admin.
describe("scrapeUserRoutes wiring", () => {
  const routes = routeStacks(scrapeUserRoutes);

  // Also the anti-vacuous guard: it.each below registers nothing if routes is
  // empty (e.g. an Express upgrade changes router.stack), so this must stay.
  it("exposes exactly the routes it means to", () => {
    expect(routes.map((r) => `${r.method} ${r.path}`).sort()).toEqual([
      "GET /jobs/:id",
      "POST /:username",
      "POST /:username/refresh",
      "POST /jobs/:id/cancel",
    ]);
  });

  it.each(routes.map((r) => [r.method, r.path, r] as const))(
    "gates %s %s behind authenticateToken but not authorizeAdmin",
    (_method, _path, route) => {
      expect(route.middleware).toContain("authenticateToken");
      expect(route.middleware).not.toContain("authorizeAdmin");
    },
  );
});
