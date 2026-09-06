@AGENTS.md

# Claude Code

Everything above is imported from `AGENTS.md`, the source of truth. Only add content here that applies to Claude Code and to nothing else.

- A11y skills: for `.tsx` work involving interactive controls, forms, dialogs, focus management, or ARIA roles — including promoting `jsx-a11y` rules from `warn` to `error` — invoke the `fixing-accessibility` skill before editing. Use `accessibility` instead for a full-page WCAG 2.2 audit. Neither is vendored; install per machine with `npx skills add ibelick/ui-skills@fixing-accessibility -g -y` and `npx skills add addyosmani/web-quality-skills@accessibility -g -y`, and skip the step if they're absent rather than blocking. **Repo conventions outrank both**: their contrast advice doesn't know about the `letterboxd-*` tokens, and their "prefer established accessible primitives" guidance doesn't override an existing hand-rolled widget — fix it in place, don't pull in a component library.
- The comment ceiling in `AGENTS.md` can be enforced automatically by a local, gitignored Stop hook — see `.claude/hooks/check-comment-blocks.mjs`. Not committed, so set it up per machine.

<!-- bd writes a BEADS INTEGRATION block into both CLAUDE.md and AGENTS.md. Only
     AGENTS.md needs it. If `bd setup claude` re-adds one below, delete it rather
     than letting the two copies drift. -->
