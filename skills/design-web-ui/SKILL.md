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

- **Where boards live**: in the design tool the repo names, when it names one
  (its workflow guide says where designs live); otherwise as repo files,
  from the design system and its real components. Never guess a tool.
- When the session offers a design tool or design-system connector, use it:
  read tokens and components from it and draw designs in it.
- Designs there use the design system's tokens by name, never copied values,
  and synthetic data only: nothing real leaves the project.
- **Value authority**: the design system, or, when the repo says so, the
  tokens exported from the tool (W3C DTCG). Where the tool differs from it,
  a mismatch is a question for the person, not a pick. A new value lands in
  the authority first, then in the tool. Where the repo declares the design
  tool leads and exports tokens from it, a new value starts in the tool and an
  export is never hand-edited.
- Link each design in the hand-off; the built screen's screenshots must match
  it.
- No such tool? Work from the design system and its real components.

### A design tool reached over MCP

Penpot is the reference case; the same holds for any tool driven this way.

- The tool's editor file must be open and MCP-connected in a browser tab. No
  connection? Stop and tell the person; never fall back to repo files for a
  repo that names the tool.
- Use the tool's own model: tokens with sets and themes bound to properties
  (no raw value where a token exists), shared libraries, components with
  variants for each state and theme, flex or grid layout so designs resize
  as the build will, and slash naming (`group/name/variant`).
- **Hand-off**: a view-mode link to each board plus an exported PNG of it.

## Design

Decide these before code:

- **Every state** (designer) of every component and screen: default,
  hover or pointed at, pressed, focused, disabled, selected, empty, loading,
  error, and success, in every theme.
- **The layout at phone width and at desktop width** (designer).
- **Visible focus, AA contrast, and touch targets** of at least 44px, in every
  theme.

## Hand-off checklist

A design is ready for the client to build when it has:

1. A board for every state, in every theme, at phone and desktop width, each
   linked where it lives (a view-mode link and an exported PNG for a tool
   board).
2. Every token cited by name, and each new value added to the value
   authority (the design system, or the tool's exported tokens when the repo
   says so).
3. Density, alignment, and the grid, with the layout at each width. Visible
   focus, AA contrast, and 44px touch targets shown on the boards.
4. The platform conventions that apply, and any new visual pattern, with its
   reason.
5. Each open behavior question answered or handed to the specification author.
6. A link to ux's hand-off.
7. The checklist ticked, for the builder to build against; the builder makes
   no visual decision and sends a gap back.

## Report

- The design choices made.
- The linked boards and the completed hand-off checklist.
