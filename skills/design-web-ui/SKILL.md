---
name: design-web-ui
description: Design and build an accessible, localized, responsive web UI — reuse the design system, cover every state, work at phone and desktop widths, by keyboard and screen reader, with copy in every language, and show screenshots. Use when designing or changing a screen, a component, or its copy.
---

# Design a web UI

**Project rules.** A project may extend this skill with a companion skill that
names it; its agent instructions (`AGENTS.md`) list it. Read both. The
companion holds the project's stack, design system, components, and tests, and
wins where they differ.

## Who does what

Two roles share this skill; a step labelled with one belongs to it alone.

- **designer**: "Design tool", the states and layouts in "Design", and the
  "Hand-off checklist". Writes no code or tests.
- **ux**: the flow, keyboard and screen-reader behavior, and copy in
  "Design", then "Build" and "Tests" from the designer's approved design.
- Both: "Read first" and "Report".

## Read first

- The cited claims and the decisions they touch.
- The code graph or index, and the design system: reuse existing components
  and tokens before designing a new one.
- The focused skills for the UI, the design system, and localization.

## Design tool

The designer's.

- When the session offers a design tool or design-system connector, use it:
  read tokens and components from it and draw designs in it.
- Designs there use the design system's tokens by name, never copied values,
  and synthetic data only: nothing real leaves the project.
- The design system wins where the tool differs; a mismatch is a question for
  the person, not a pick. A new value lands in the design system first, then
  in the tool.
- Link each design in the hand-off; the built screen's screenshots must match
  it.
- No such tool? Work from the design system and its real components.

## Design

Decide these before code:

- **The flow** (ux): what the user does, in what order.
- **The four states** (designer) of every screen and component that loads or
  submits: empty, loading, error, success.
- **The layout at phone width and at desktop width** (designer).
- **Keyboard and screen-reader behavior** (ux): reading order, focus order,
  names, and announcements.
- **The copy in every supported language** (ux).

## Build

ux's, from the designer's approved design.

- The smallest design that satisfies the cited claims.
- Accessible, localized, responsive markup that follows the design system.
  - Semantic HTML, visible focus, 44px touch targets, reduced-motion support,
    and AA contrast.
  - Every user-facing string and accessible label lives in the locale
    catalogues, never in the markup.
  - Design tokens, not raw colors.
- A new visual pattern comes from the designer, and only where the design
  system has none.

## Tests

ux's.

- Component tests for what you build, written as a user would act: by role and
  label.
- Acceptance step definitions and browser scenarios belong to the test writer;
  make them pass.

## Hand-off checklist

The designer's. A design is ready for ux to build when it has:

1. A board for every state at phone and desktop width, each linked where it
   lives.
2. Every token cited by name, and each new value added to the design system.
3. Each open behavior question answered or handed to the specification author.

## Report

- The design choices made.
- ux: the files changed, the test results, and a screenshot of each changed
  screen, in the primary language.
- designer: the linked boards and the completed hand-off checklist.
