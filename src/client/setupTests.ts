import "@testing-library/jest-dom/vitest";

// jsdom implements no layout, so scrollIntoView is simply absent. Components
// that keep an active item in view call it on every keyboard move.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// Also absent from jsdom. useMediaQuery reads it during render, so a component
// that branches on a breakpoint cannot mount without this.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
