---
name: design-avalonia-ui
description: Design an Avalonia UI before it is built — tokens, Light and Dark variants, control states, desktop and touch density, drawn versus templated controls, boards for review, and the checklist handed to a builder. Use when designing or changing an Avalonia screen, component, or theme.
---

# Design an Avalonia UI

**Project rules.** This skill is the Avalonia layer of `design-native-ui`, the
generic skill it extends and must be installed alongside: read both, and
this one wins where they differ. A project may extend this skill with a
companion skill that names it; its agent instructions (`AGENTS.md`) list
it. Read it too. The companion holds the project's design-system page,
components, and tests, and wins where they differ. For a web UI use
`design-web-ui`. The implementation (resources, control themes, selectors,
automation) is `build-avalonia-ui`.

## Read first

- `design-native-ui` "Read first": the cited claims, ux's hand-off, and the
  design-system page, and never invented behaviour.

## Design tool

- As `design-native-ui` "Design tool". A new value lands on the page first,
  then in the tool and the theme resources.

## Tokens

- Every token from `design-native-ui` "Tokens" is cited by name, never as a
  literal.
- Every theme-dependent token has a value in both the Light and Dark
  variants; both define the same keys.

## Components

- **Templated** controls are the default: they inherit states, focus, and
  accessibility. **Drawn** controls are for custom visuals only, and the
  design shows their focus and every state.
- Override Fluent's look without fighting it: name the Fluent values each
  component changes.

## States

Design every state in `design-native-ui` "States" on every component, in both
the Light and Dark themes.

## Density and layout

- As `design-native-ui` "Input and density" and "Window and screen sizes":
  desktop and touch density, targets, the grid, and text growth.

## Accessibility

- As `design-native-ui` "Accessibility": what the designer draws. The names
  and the rest of the semantics are ux's.

## Boards

- As `design-native-ui` "Boards": Light and Dark, every state, at desktop and
  touch density, from the real themes or the design tool.

## Hand-off checklist

A design is ready for a builder when it has `design-native-ui` "Hand-off
checklist", in Avalonia's terms:

1. Boards for every theme, state, density, and window size, each linked where
   it lives.
2. Every token cited by name, and each new value added to the design-system
   page.
3. Per component, the token each state uses in each variant, and whether it
   is templated or drawn.
4. A link to ux's hand-off: the automation names, focus order, and copy keys.
5. The platform conventions followed for each target, and where the design
   system overrides one.
6. Each open behavior question answered or handed to the specification author.
7. The checklist ticked, for the builder to build against; a gap goes back to
   the designer.
