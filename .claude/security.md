---
description: Security and safety guidelines for the BPDiscord codebase. Covers authorization patterns, database mutation safety, and client-side hygiene. Follow these rules when adding or modifying any server routes, controllers, database operations, or API client code.
globs: *.ts,*.tsx
---

# Security & Safety Guidelines

These rules exist because of real bugs found in this codebase. Every rule maps to an actual incident. Follow them strictly.

## 1. Authorization Must Be Enforced at the Route Level

**Never** rely solely on checks inside controller functions for authorization. Use middleware on the router so that authorization is structurally guaranteed and cannot be forgotten.

```typescript
// WRONG — fragile, easy to forget on new endpoints
router.post("/admin/things", authenticateToken, createThing);
// then inside createThing:
//   if (!isAdmin(req)) { res.status(403)... }

// RIGHT — middleware enforces it; controller stays focused on business logic
router.post("/admin/things", authenticateToken, authorizeAdmin, createThing);
```

- `authenticateToken` verifies the JWT and attaches `req.user`.
- `authorizeAdmin` checks `req.user.user_metadata.role === "admin"` and returns 403 if not.
- Both live in `src/server/middleware/auth.ts`.
- When adding a new admin route, always chain: `authenticateToken, authorizeAdmin, handler`.
- If a new role is introduced (e.g., `moderator`), create a dedicated middleware for it.

## 2. Never Log Secrets or Tokens

Do not `console.log` tokens, API keys, passwords, or any sensitive values — not even temporarily during development. Debug logs get committed, and browser consoles are accessible to extensions and shared screens.

```typescript
// WRONG
console.log("TOKEN", token);
console.log("API_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);

// RIGHT — log non-sensitive context instead
console.log("Auth request for user:", username);
```

If you need to inspect a token during development, use a debugger breakpoint instead.

## 3. Database Mutations Must Maintain Invariants

When a mutation implies a constraint (e.g., "only one winner per category"), enforce it in the database operation, not by hoping the caller does the right thing.

```typescript
// WRONG — sets one nominee but leaves stale winners
await db.update(nominees).set({ isWinner: true }).where(eq(nominees.id, id));

// RIGHT — use a transaction to clear old winners first
await db.transaction(async (tx) => {
  // Clear existing winners in the same category
  await tx.update(nominees)
    .set({ isWinner: false })
    .where(and(eq(nominees.categoryId, catId), eq(nominees.isWinner, true)));
  // Set the new winner
  await tx.update(nominees)
    .set({ isWinner: true })
    .where(eq(nominees.id, id));
});
```

Use `dbTransaction` from `src/server/db/utils.ts` for any operation that involves multiple related writes.

## 4. API Client Must Always Send Content-Type

When the `ApiService.request()` method merges headers, ensure custom headers (like `Authorization`) don't overwrite defaults (like `Content-Type`). The correct pattern destructures headers separately:

```typescript
// WRONG — ...options overwrites the merged headers object
const config = {
  headers: { "Content-Type": "application/json", ...options.headers },
  ...options, // <-- this replaces headers entirely
};

// RIGHT — spread restOptions first, then merge headers explicitly
const { headers: optionHeaders, ...restOptions } = options;
const config = {
  ...restOptions,
  headers: { "Content-Type": "application/json", ...optionHeaders },
};
```

Without `Content-Type: application/json`, Express cannot parse `req.body` and all body fields arrive as `undefined`.

## 5. Validate Inputs at the Server Boundary

Always validate request parameters before passing them to database functions:

- **Type checks**: `typeof isWinner !== "boolean"` should return 400, not let Postgres throw 500.
- **Format checks**: UUID parameters from route params should be validated as UUIDs before hitting the database.
- **Required fields**: Check for missing required fields and return descriptive 400 errors.

```typescript
// Good pattern for route param validation
const { id } = req.params;
if (!id || !isValidUUID(id)) {
  res.status(400).json({ error: "Valid UUID is required" });
  return;
}
```

## 6. Database Enum Fields Need Constraints

When a field has a known set of valid values (like `status: "active" | "inactive"` or `displayMode: "movie_first" | "person_first"`), enforce this at the database level — not just in TypeScript types. Client types can be bypassed via direct API calls.

Options:
- Use a Postgres `CHECK` constraint
- Use a Drizzle `pgEnum`
- Validate in the controller before writing

## 7. Seed Scripts and One-Off Operations

- **Idempotency**: Seed scripts should check for existing data or use `onConflictDoNothing()` so they can be safely re-run.
- **Environment**: Seed scripts must load environment variables before importing database modules. Use `dotenv` at the top of the script or pass `DATABASE_URL` inline.
- **Transactions**: Wrap multi-step seed operations in a transaction so partial failures don't leave the database in an inconsistent state.

## 8. Client Token Handling

Do not read `localStorage.getItem("token")` directly. The `AuthProvider`
(`src/client/contexts/AuthContext.tsx`) is the single owner of the auth token
and the `/me`-resolved `CurrentUser`. Consume it via `useAuth()`:

```typescript
// WRONG — bypasses the provider, can hold a stale value, won't react to logout
const token = localStorage.getItem("token") || "";

// RIGHT — reactive, updates on login/logout same-tab and cross-tab
const { token, user, login, logout } = useAuth();
```

Same-tab login/logout propagate through React; the provider's `storage`
listener syncs other tabs. `login(token)` persists the JWT and resolves the
identity from `/me`; `logout()` clears it. No component or hook should write
the token or the legacy `"user"` blob itself. A failed `/me` (e.g. expired
token) nulls the user but intentionally leaves the token in place — the next
authed request surfaces the 401.
