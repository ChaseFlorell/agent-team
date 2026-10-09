---
name: design-web-ui
description: Design and build an accessible, localized, responsive web UI — reuse the design system, cover every state, work at phone and desktop widths, by keyboard and screen reader, with copy from the locale catalogues, and show screenshots. Use when designing or building a screen or a component.
---

# Design a web UI

**Project rules.** A project may extend this skill with a companion skill that
names it; its agent instructions (`AGENTS.md`) list it. Read both. The
companion holds the project's stack, design system, components, and tests, and
wins where they differ.

## Who does what

Two roles share this skill; a step labelled with one belongs to it alone.

- **designer**: "Design tool", "Design", and the "Hand-off checklist".
- **client**: "Build" and "Tests", from the designer's approved design and
  ux's hand-off.
- Both: "Read first" and "Report".

The flow, the accessibility semantics, and the copy are ux's, in
`design-ux-flow`.

## Read first

- The cited claims and the decisions they touch.
- ux's hand-off: the flow, accessibility semantics, and copy keys.
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

- **The four states** (designer) of every screen and component that loads or
  submits: empty, loading, error, success.
- **The layout at phone width and at desktop width** (designer).

## Build

client's, from the designer's approved design and ux's hand-off.

- The smallest design that satisfies the cited claims.
- Accessible, localized, responsive markup that follows the design system and
  ux's flow and semantics.
  - Semantic HTML, visible focus, 44px touch targets, reduced-motion support,
    and AA contrast.
  - Every user-facing string and accessible label comes from the locale
    catalogues (ux's entries), never from the markup. A missing key goes back
    to ux.
  - Design tokens, not raw colors.
- A new visual pattern comes from the designer, and only where the design
  system has none.

## Tests

client's.

- Component tests for what you build, written as a user would act: by role and
  label.
- Acceptance step definitions and browser scenarios belong to the test writer;
  make them pass.

## Hand-off checklist

The designer's. A design is ready for the client to build when it has:

1. A board for every state at phone and desktop width, each linked where it
   lives.
2. Every token cited by name, and each new value added to the design system.
3. Each open behavior question answered or handed to the specification author.
4. A link to ux's hand-off.

## Report

- The design choices made.
- client: the files changed, the test results, and a screenshot of each changed
  screen, in the primary language.
- designer: the linked boards and the completed hand-off checklist.
