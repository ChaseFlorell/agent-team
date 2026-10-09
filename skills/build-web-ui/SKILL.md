---
name: build-web-ui
description: Build a web UI exactly to its hand-off — the UX designer's flow, accessibility semantics, and copy keys and the UI designer's approved boards — as accessible, localized, responsive markup that follows the design system, with component tests, and show screenshots. Use when implementing or changing a web screen or component.
---

# Build a web UI

**Project rules.** A project may extend this skill with a companion skill that
names it; its agent instructions (`AGENTS.md`) list it. Read both. The
companion holds the project's stack, design system, components, and tests, and
wins where they differ.

The builder implements; it makes no UX or visual decision. The hand-off
decides, and a gap goes upstream.

## Read first

- The cited claims and the decisions they touch.
- ux's hand-off (`design-ux-flow` "Hand-off") and the designer's hand-off
  (`design-web-ui` "Hand-off checklist"). Either incomplete or ambiguous?
  Stop and send the question to ux or the designer; never guess.
- The code graph or index, and the design system's real components and tokens.
- The focused skills for the UI, the design system, and localization.

## Build

- The smallest build that satisfies the cited claims and matches the boards.
- Accessible, localized, responsive markup that follows the design system,
  ux's flow and semantics, and the boards.
  - Semantic HTML and reduced-motion support.
  - Every state, every theme, visible focus, 44px touch targets, and AA
    contrast as the boards specify; never decided here.
  - Every user-facing string and accessible label comes from the locale
    catalogues (ux's entries), never from the markup. A missing key goes back
    to ux.
  - Design tokens, not raw colors.
- A pattern the boards and the design system lack goes back to the designer.

## Tests

- Component tests for what you build, written as a user would act: by role and
  label.
- Acceptance step definitions, including the browser runner's, belong to the
  test writer; make them pass.

## Report

- The files changed and the test results.
- A screenshot of each changed screen, in the primary language, beside its
  board.
- Any gap sent upstream, and its answer.
