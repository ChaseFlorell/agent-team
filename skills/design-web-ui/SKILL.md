---
name: design-web-ui
description: Design and build an accessible, localized, responsive web UI — reuse the design system, cover every state, work at phone and desktop widths, by keyboard and screen reader, with copy in every language, and show screenshots. Use when designing or changing a screen, a component, or its copy.
---

# Design a web UI

**Project rules.** A project may extend this skill with a companion skill that
names it; its agent instructions (`AGENTS.md`) list it. Read both. The
companion holds the project's stack, design system, components, and tests, and
wins where they differ.

## Read first

- The cited claims and the decisions they touch.
- The code graph or index, and the design system: reuse existing components
  and tokens before designing a new one.
- The focused skills for the UI, the design system, and localization.

## Design tool

- When the session offers a design tool or design-system connector, use it:
  read tokens and components from it, render boards in it, and keep them where
  it keeps them.
- Boards drawn there use the project's tokens by name, never copied values;
  the builder's screenshots must still match them.
- The design-system page stays the source builders cite: a new value lands
  there first, then in the tool.
- No such tool? Work from the design-system page and the real components.

## Design

Decide these before code:

- **The flow**: what the user does, in what order.
- **The four states** of every screen and component that loads or submits:
  empty, loading, error, success.
- **The layout at phone width and at desktop width.**
- **Keyboard and screen-reader behavior**: reading order, focus order, names,
  and announcements.
- **The copy in every supported language.**

## Build

- The smallest design that satisfies the cited claims.
- Accessible, localized, responsive markup that follows the design system.
  - Semantic HTML, visible focus, 44px touch targets, reduced-motion support,
    and AA contrast.
  - Every user-facing string and accessible label lives in the locale
    catalogues, never in the markup.
  - Design tokens, not raw colors.
- A new visual pattern only where the design system has none.

## Tests

- Component tests for what you build, written as a user would act: by role and
  label.
- Acceptance step definitions and browser scenarios belong to the test writer;
  make them pass.

## Report

- The design choices made, the files changed, and the test results.
- A screenshot of each changed screen, in the primary language.
