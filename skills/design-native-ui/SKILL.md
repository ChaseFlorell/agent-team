---
name: design-native-ui
description: Design a native desktop or mobile UI before it is built, on any stack — platform conventions (Human Interface Guidelines, Material, Fluent) against the design system, pointer and touch input and density, every state in every theme with high contrast and large text, accessibility through the platform's APIs, window and screen sizes, orientation, and safe areas, boards for review, and the checklist handed to a builder. Use when designing or changing a native screen, component, or theme.
---

# Design a native UI

**Project rules.** A UI stack or a project may extend this skill with a
companion skill that names it: `design-avalonia-ui` for Avalonia; a project's
companions are listed in its agent instructions (`AGENTS.md`). Read every one
that applies. A stack companion holds the stack's resources, controls, and
selectors; a project companion holds the project's design-system page,
components, and tests. The more specific wins where they differ: the project's,
then the stack's, then this one. For a web UI use `design-web-ui`; the flow,
accessibility semantics, and copy are `design-ux-flow`.

## Read first

- The cited claims, and the design-system page: reuse its tokens and
  components before designing a new one.
- The platform guidelines for each target: Apple's Human Interface Guidelines,
  Material, or Fluent.
- Never invent behaviour the claims lack; ask, or hand it to the specification
  author.

## Design tool

- When the session offers a design tool or design-system connector, use it:
  read tokens and components from it and render boards in it.
- Boards there use the project's tokens by name, never copied values, and
  synthetic data only: nothing real leaves the project.
- The design-system page wins where the tool differs; a mismatch is a question
  for the person, not a pick. A new value lands on the page first, then in the
  tool and the stack's theme resources.
- Link each board in the hand-off; a tool board is checked against a
  real-theme screenshot before it is approved.
- No such tool? Work from the design-system page and the real themes.

## Platform conventions

- **Follow the host platform** where users expect it to behave like every
  other app there: navigation and back, menus and the app bar, dialog and
  sheet layout and button order, system text sizes, keyboard shortcuts, and
  standard controls (pickers, switches, share, file dialogs).
- **The design system wins** for the product's own look: colour, type,
  iconography, and the appearance of its components, kept the same across
  platforms.
- A design-system rule that would break a platform convention users rely on
  (a gesture, the back behaviour, the accessibility settings) is a question
  for the person, not a pick. Record the answer per platform on the
  design-system page.

## Tokens

- Every colour, size, spacing, radius, font, and duration is a named token,
  cited from the design-system page, never copied as a literal.
- Every theme the product supports defines the same token keys.
- A new value goes on the design-system page first, then into the stack's
  theme resources.

## Components

- Restyle the platform's or the design system's stock controls by default:
  they inherit states, focus, and accessibility.
- A custom-drawn control is for custom visuals only, and must supply its own
  focus, states, and accessibility element.

## States

Design every state on every component, in every theme:

- default, pointed at (hover), pressed, keyboard-focused, disabled, selected,
  empty, error, and loading;
- under the platform's high-contrast setting, and at its largest dynamic or
  accessibility text size.

A state differs by more than colour alone, and keeps AA contrast in every
theme.

## Input and density

- Pointer and touch differ: touch has no hover, so nothing is reachable only
  by hover, and a touch target is at least 44 logical pixels (Material's is
  48) with space between targets.
- Desktop is compact and pointer-first; touch is roomier. Design both, or say
  which is out of scope.
- Every action works by keyboard where the platform has one: a focus order
  that follows reading order, focus always visible, and the platform's
  shortcuts.

## Window and screen sizes

- Design the smallest and the largest supported window or screen, and say how
  the layout resizes between them.
- Portrait and landscape where the platform rotates; say which, if either, is
  out of scope.
- Keep content and controls inside the safe areas: clear of notches, rounded
  corners, the home indicator, and the system bars.
- Spacing and sizes sit on one grid; align edges and text baselines on it.
- Layout survives text growth, large text, and every supported language: no
  fixed widths on text.

## Accessibility

The semantics (names, roles, reading and focus order, announcements) are
ux's, from `design-ux-flow`; the designer draws focus, contrast, and large
text, and the builder implements the semantics through the platform's
accessibility APIs, never a parallel mechanism:

- every control that shows no text has an accessible name, and help text
  where useful;
- every custom control reports its role, value, and state;
- decoration is hidden from the accessibility tree;
- focus order follows reading order, and focus is always visible;
- honour reduced motion, high contrast, and large text.

## Boards

- Render each component and screen in every theme, every state, at each
  density and window size, from the real themes or the design tool, never a
  hand-drawn mock-up.
- Review boards as screenshots; the builder's screenshots must match them.

## Hand-off checklist

A design is ready for a builder when it has:

1. Boards for every theme, state, density, and window size, each linked where
   it lives.
2. Every token cited by name, and each new value added to the design-system
   page.
3. The stack's styling per component: its theme or style and the selector or
   trigger for each state.
4. A link to ux's hand-off: the accessible names, roles, focus order, and
   copy keys.
5. Each open behaviour question answered or handed to the specification
   author.
