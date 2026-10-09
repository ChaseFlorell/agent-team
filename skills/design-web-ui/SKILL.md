---
name: design-web-ui
description: Design an accessible, responsive web UI before it is built — reuse the design system, boards for every state at phone and desktop widths, and the checklist handed to the builder. Use when designing or changing the look of a web screen or component.
---

# Design a web UI

**Project rules.** A project may extend this skill with a companion skill that
names it; its agent instructions (`AGENTS.md`) list it. Read both. The
companion holds the project's stack, design system, components, and tests, and
wins where they differ.

The designer's. The flow, accessibility semantics, and copy are ux's
(`design-ux-flow`); building is the client's (`build-web-ui`). The hand-off
leaves the builder no visual decision.

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

## Hand-off checklist

A design is ready for the client to build when it has:

1. A board for every state at phone and desktop width, each linked where it
   lives.
2. Every token cited by name, and each new value added to the design system.
3. Density, alignment, and the grid, with the layout at each width.
4. The platform conventions that apply, and any new visual pattern, with its
   reason.
5. Each open behavior question answered or handed to the specification author.
6. A link to ux's hand-off.
7. The checklist ticked, for the builder to build against; the builder makes
   no visual decision and sends a gap back.

## Report

- The design choices made.
- The linked boards and the completed hand-off checklist.
