---
name: design-avalonia-ui
description: Design an Avalonia UI before it is built — tokens as theme-aware resources, Light and Dark variants, one control theme per component, pseudo-class states, desktop and touch density, drawn versus templated controls, accessibility, boards for review, and the checklist handed to a builder. Use when designing or changing an Avalonia screen, component, or theme.
---

# Design an Avalonia UI

**Project rules.** A project may extend this skill with a companion skill that
names it; its agent instructions (`AGENTS.md`) list it. Read both. The
companion holds the project's design-system page, components, and tests, and
wins where they differ. For a web UI use `design-web-ui`.

## Read first

- The cited claims, and the design-system page: reuse its tokens and
  components before designing a new one.
- Never invent behavior the claims lack; ask, or hand it to the specification
  author.

## Tokens

- Every color, size, spacing, radius, font, and duration is a named resource,
  cited from the design-system page, never copied as a literal.
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

Design every state on every component, in both themes:

- default, pointed at (`:pointerover`), pressed (`:pressed`), keyboard-focused
  (`:focus-visible`), disabled (`:disabled`), selected (`:selected`), empty,
  error, and loading.
- Each state is a pseudo-class selector on the control theme, not code-behind.
- A state differs by more than color alone, and keeps AA contrast in both
  themes.

## Density and layout

- Desktop is compact and pointer-first; touch needs targets of at least 44
  logical pixels with space between them. Design both, or say which is out
  of scope.
- Spacing and sizes sit on one grid; align edges and text baselines on it.
- Layout survives text growth and every supported language: no fixed widths on
  text.

## Accessibility

- Set `AutomationProperties.Name` (and `HelpText` where useful) on every
  control that shows no text; hide decoration from the tree.
- Focus order follows reading order; focus is always visible.
- Honor reduced motion and the system's contrast settings.

## Boards

- Render each component and screen in Light and Dark, every state, at desktop
  and touch density, from the real themes, not a mock-up.
- Review boards as screenshots; the builder's screenshots must match them.

## Hand-off checklist

A design is ready for a builder when it has:

1. Boards for every theme, state, and density.
2. Every token cited by name, and each new value added to the design-system
   page.
3. The control theme and selectors per component.
4. The automation names and focus order.
5. Each open behavior question answered or handed to the specification author.
