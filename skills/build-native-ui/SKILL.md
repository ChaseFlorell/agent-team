---
name: build-native-ui
description: Build a native desktop or mobile UI exactly to its hand-off, on any stack — the UX designer's flow, accessibility semantics, and copy keys and the UI designer's approved boards — mapping semantics to the platform's accessibility APIs, honouring platform conventions, with component and UI tests. Use when implementing or changing a native screen, view model, or component.
---

# Build a native UI

**Project rules.** A UI stack or a project may extend this skill with a
companion skill that names it: `build-avalonia-ui` for Avalonia; a project's
companions are listed in its agent instructions (`AGENTS.md`). Read every one
that applies. The more specific wins where they differ: the project's, then
the stack's, then this one. For a web UI use `build-web-ui`.

The builder implements; it makes no UX or visual decision. The hand-off
decides, and a gap goes upstream.

## Read first

- The cited claims and the decisions they touch.
- ux's hand-off (`design-ux-flow` "Hand-off") and the designer's hand-off
  (`design-native-ui` "Hand-off checklist") for each target platform. Either
  incomplete or ambiguous? Stop and send the question to ux or the designer;
  never guess.
- The design system's real themes, resources, and components.
- The focused skills for the UI, the design system, and localization.

## Build

- The smallest build that satisfies the cited claims and matches the boards.
- Tokens are the design system's named resources, never literals; every
  supported theme defines the same keys.
- Restyle stock controls by default. A custom-drawn control is for custom
  visuals only and supplies its own focus, states, and accessibility element.
- States come from the hand-off: default, pointed at, pressed, focused,
  disabled, selected, empty, error, and loading, in every theme, under high
  contrast and large text.
- Accessibility goes through the platform's APIs, never a parallel mechanism:
  names, roles, values, reading and focus order, and announcements exactly as
  ux's semantics state; decoration hidden from the tree.
- Follow the platform's conventions as the designer's hand-off records them.
- Every user-facing string and accessible label comes from the locale
  catalogues (ux's entries), never from code. A missing key goes back to ux.
- Layout survives text growth and every supported language: no fixed widths on
  text, content inside the safe areas.

## Tests

- Component and UI tests for what you build, written as a user would act: by
  accessible name and role.
- Acceptance step definitions belong to the test writer; make them pass.

## Report

- The files changed and the test results.
- A screenshot of each changed screen in each theme, beside its board.
- Any gap sent upstream, and its answer.
