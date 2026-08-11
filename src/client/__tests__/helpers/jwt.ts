// AuthProvider inspects the `exp` claim, so seeded tokens must be structurally
// real. The signature is a throwaway — the client never verifies it.
export function makeJwt(expEpochSeconds: number): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(JSON.stringify({ exp: expEpochSeconds }));
  return `${header}.${payload}.sig`;
}

export const futureJwt = (): string =>
  makeJwt(Math.floor(Date.now() / 1000) + 3600);

export const expiredJwt = (): string =>
  makeJwt(Math.floor(Date.now() / 1000) - 3600);
