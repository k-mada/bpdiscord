import axe from "axe-core";

// axe-core directly rather than a matcher wrapper: vitest-axe is 0.1.0 and
// unpublished since early 2025, while axe-core ships monthly.
export async function axeViolations(
  container: HTMLElement,
): Promise<string[]> {
  const results = await axe.run(container, {
    // jsdom has no layout, so anything needing geometry reports false results.
    rules: { "color-contrast": { enabled: false } },
  });
  return results.violations.map(
    (v) => `${v.id}: ${v.nodes.length} node(s) — ${v.help}`,
  );
}
