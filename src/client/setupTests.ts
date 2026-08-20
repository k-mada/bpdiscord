import "@testing-library/jest-dom/vitest";

// jsdom implements no layout, so scrollIntoView is simply absent. Components
// that keep an active item in view call it on every keyboard move.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
