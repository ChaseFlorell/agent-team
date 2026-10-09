---
name: design-avalonia-ui
description: Design an Avalonia UI before it is built — tokens as theme-aware resources, Light and Dark variants, one control theme per component, pseudo-class states, desktop and touch density, drawn versus templated controls, accessibility, boards for review, and the checklist handed to a builder. Use when designing or changing an Avalonia screen, component, or theme.
---

# Design an Avalonia UI

**Project rules.** This skill is the Avalonia layer of `design-native-ui`, the
generic skill it extends and must be installed alongside: read both, and
this one wins where they differ. A project may extend this skill with a
companion skill that names it; its agent instructions (`AGENTS.md`) list
it. Read it too. The companion holds the project's design-system page,
components, and tests, and wins where they differ. For a web UI use
`design-web-ui`.

## Read first

- `design-native-ui` "Read first": the cited claims and the design-system
  page, and never invented behaviour.

## Design tool

- As `design-native-ui` "Design tool". A new value lands on the page first,
  then in the tool and the theme dictionaries.

## Tokens

- Every token from `design-native-ui` "Tokens" is a named resource, never a
  literal.
- A value that changes with the theme is a `DynamicResource`; a constant
  (spacing, radius) may be a `StaticResource`.
  - `StaticResource` resolves once at load and never follows a theme switch.
- Define theme-dependent tokens per variant in `ThemeDictionaries` with
  `Light` and `Dark` keys. Both variants define the same keys.
- A new value goes on the design-system page first, then into the dictionary.

## Components

- One `ControlTheme` per component, keyed by the control type, with a
  `ControlTemplate` and its `^`-selector states.
- Use a `ControlTheme` to restyle a control wholesale; use a `Style` to adjust
  a few properties or to target many controls by selector.
- Override Fluent without fighting it: set the Fluent resource keys it already
  reads, or add a theme for your own control. Do not copy Fluent's templates
  or fight its selectors with `!important`-style specificity tricks.
- **Templated** controls are the default: they inherit states, focus, and
  accessibility. **Drawn** controls (an overridden `Render`) are for custom
  visuals only, and must supply their own focus, states, and automation peer.

## States

Design every state in `design-native-ui` "States" on every component, in both
the Light and Dark themes:

- pointed at is `:pointerover`, pressed `:pressed`, keyboard-focused
  `:focus-visible`, disabled `:disabled`, and selected `:selected`.
- Each state is a pseudo-class selector on the control theme, not code-behind.

## Density and layout

- As `design-native-ui` "Input and density" and "Window and screen sizes":
  desktop and touch density, targets, the grid, and text growth.

## Accessibility

- The builder sets `AutomationProperties.Name` (and `HelpText` where useful)
  from ux's names on every control that shows no text, and hides decoration
  from the tree.
- The rest as `design-native-ui` "Accessibility": focus order and visibility,
  reduced motion, and the system's contrast settings.

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
3. The control theme and selectors per component.
4. A link to ux's hand-off: the automation names, focus order, and copy keys.
5. Each open behavior question answered or handed to the specification author.
