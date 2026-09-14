import userAdminRoutes from "../routes/userAdminRoutes";
import { routeStacks } from "./helpers/routerStack";

// Asserting middleware NAMES catches a route that loses authorizeAdmin (any
// logged-in user reaching an admin endpoint) — blind to routeAuth.test.ts.
describe("userAdminRoutes wiring", () => {
  const routes = routeStacks(userAdminRoutes);

  // Also the anti-vacuous guard: it.each below registers nothing if routes is
  // empty (e.g. an Express upgrade changes router.stack), so this must stay.
  it("exposes exactly the routes it means to", () => {
    expect(routes.map((r) => `${r.method} ${r.path}`).sort()).toEqual([
      "DELETE /:id",
      "DELETE /by-lbusername/:lbusername",
      "GET /",
      "PUT /:id",
    ]);
  });

  it.each(routes.map((r) => [r.method, r.path, r] as const))(
    "gates %s %s behind authenticateToken then authorizeAdmin",
    (_method, _path, route) => {
      expect(route.middleware).toContain("authenticateToken");
      expect(route.middleware).toContain("authorizeAdmin");
      // Order matters: authorizeAdmin reads req.user, which only authenticateToken sets.
      expect(route.middleware.indexOf("authenticateToken")).toBeLessThan(
        route.middleware.indexOf("authorizeAdmin"),
      );
    },
  );
});
