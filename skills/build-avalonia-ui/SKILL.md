---
name: build-avalonia-ui
description: Build an Avalonia UI exactly to its hand-off — theme-aware resources, one control theme per component, pseudo-class states, automation properties, and component and UI tests. Use when implementing or changing an Avalonia screen, view model, component, or theme.
---

# Build an Avalonia UI

**Project rules.** This skill is the Avalonia layer of `build-native-ui`, the
way `design-avalonia-ui` is the Avalonia layer of `design-native-ui`. A project
may extend it with a companion skill that names it; its agent instructions
(`AGENTS.md`) list it. Read both. The companion holds the project's resources,
components, and tests, and wins where they differ. For a web UI use
`build-web-ui`.

## Read first

- `build-native-ui` "Read first": the hand-offs, and a gap goes upstream.
- The designer's hand-off in Avalonia's terms (`design-avalonia-ui` "Hand-off
  checklist"): the control theme and selectors per component.

## Resources

- Every token is a named resource, never a literal.
- A value that changes with the theme is a `DynamicResource`; a constant
  (spacing, radius) may be a `StaticResource`, which never follows a theme
  switch.
- Theme-dependent tokens live per variant in `ThemeDictionaries` with `Light`
  and `Dark` keys, both defining the same keys.

## Components

- One `ControlTheme` per component, keyed by the control type, with the
  `ControlTemplate` and `^`-selector states the hand-off names.
- Pointed at is `:pointerover`, pressed `:pressed`, keyboard-focused
  `:focus-visible`, disabled `:disabled`, selected `:selected`; each is a
  pseudo-class selector, not code-behind.
- Override Fluent by setting the resource keys it already reads, or by adding
  a theme for your own control; never copy its templates.
- Templated controls are the default. A drawn control (an overridden
  `Render`) supplies its own focus, states, and automation peer.

## Accessibility

- Set `AutomationProperties.Name` (and `HelpText` where useful) from ux's
  names on every control that shows no text; hide decoration from the tree.
- Focus order, announcements, and the rest as ux's semantics state.

## Tests

As `build-native-ui` "Tests".

## Report

As `build-native-ui` "Report".
