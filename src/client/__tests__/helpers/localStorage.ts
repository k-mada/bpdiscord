// jsdom in this project's vitest config doesn't expose window.localStorage;
// install a Map-backed fake so tests can read/write localStorage normally.
export function installFakeLocalStorage(): void {
  const store = new Map<string, string>();
  const fake: Storage = {
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => {
      store.set(k, String(v));
    },
    removeItem: (k) => {
      store.delete(k);
    },
    clear: () => {
      store.clear();
    },
    key: (i) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: fake,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(window, "localStorage", {
    value: fake,
    writable: true,
    configurable: true,
  });
}
