---
name: design-native-ui
description: Design a native desktop or mobile UI before it is built, on any stack — platform conventions (Human Interface Guidelines, Material, Fluent) against the design system, pointer and touch input and density, every state in every theme with high contrast and large text, accessibility through the platform's APIs, window and screen sizes, orientation, and safe areas, boards for review, and the checklist handed to a builder. Use when designing or changing a native screen, component, or theme.
---

# Design a native UI

**Project rules.** A UI stack or a project may extend this skill with a
companion skill that names it: `design-avalonia-ui` for Avalonia; a project's
companions are listed in its agent instructions (`AGENTS.md`). Read every one
that applies. A stack companion holds the stack's resources, controls, and
states; a project companion holds the project's design-system page,
components, and tests. The more specific wins where they differ: the project's,
then the stack's, then this one. For a web UI use `design-web-ui`; the flow,
accessibility semantics, and copy are `design-ux-flow`.

## Read first

- The cited claims, and the design-system page: reuse its tokens and
  components before designing a new one.
- ux's hand-off (`design-ux-flow` "Hand-off"): the flow, accessibility
  semantics, and copy keys.
- The platform guidelines for each target: Apple's Human Interface Guidelines,
  Material, or Fluent.
- Never invent behaviour the claims lack; ask, or hand it to the specification
  author.

## Design tool

- **Where boards live**: in the design tool the repo names, when it names one
  (its workflow guide says where designs live); otherwise as repo files,
  from the design-system page and the real themes. Never guess a tool.
- When the session offers a design tool or design-system connector, use it:
  read tokens and components from it and render boards in it.
- Boards there use the project's tokens by name, never copied values, and
  synthetic data only: nothing real leaves the project.
- **Value authority**: the design-system page, or, when the repo says so,
  the tokens exported from the tool (W3C DTCG). Where the tool differs from
  that authority, a mismatch is a question for the person, not a pick. A
  new value lands in the authority first, then in the tool and the stack's
  theme resources.
- **A repo that declares the design tool leads and exports tokens from it**:
  a new value starts in the tool, the stack's theme resources are generated
  from the export, and an export is never hand-edited. The repo's workflow
  guide says what the exported tokens hold until the next export, and where a
  builder gets a value the export lacks. The design-system page then holds
  prose rules, not values.
- Link each board in the hand-off; a tool board is checked against a
  real-theme screenshot before it is approved.
- No such tool? Work from the design-system page and the real themes.

### A design tool reached over MCP

Penpot is the reference case; the same holds for any tool driven this way.

- The tool's editor file must be open and MCP-connected in a browser tab. No
  connection? Stop and tell the person; never fall back to repo files for a
  repo that names the tool.
- Use the tool's own model, never a parallel one:
  - **Tokens** with sets and themes (a theme per supported theme), bound to
    properties; no raw value where a token exists.
  - **Shared libraries** for components and tokens; reuse before drawing new.
  - **Components with variants**, one per state, density, and theme axis.
  - **Flex or grid layout**, so boards resize as the build will.
  - **Slash naming** for tokens, components, and variants
    (`group/name/variant`), matching the design-system page.
- **Hand-off**: a view-mode link to each board plus an exported PNG of it.
  The builder reads the link; the PNG is the screenshot the build is
  checked against.

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
  theme resources, unless the repo declares the design tool leads (see
  "Design tool"): then it starts in the tool, and the theme resources are
  generated, never hand-edited.

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
- Every action works by keyboard where the platform has one: focus always
  visible, and the platform's shortcuts. The focus order is ux's.

## Window and screen sizes

- Design the smallest and the largest supported window or screen, and say how
  the layout resizes between them.
- Portrait and landscape where the platform rotates; say which, if either, is
  out of scope.
- A repo may define its form factors as devices, not widths (for example
  desktop, tablet in each orientation, phone): follow its list, and a device
  follows its own boards whatever its width.
- Keep content and controls inside the safe areas: clear of notches, rounded
  corners, the home indicator, and the system bars.
- Spacing and sizes sit on one grid; align edges and text baselines on it.
- Layout survives text growth, large text, and every supported language: no
  fixed widths on text.

## Accessibility

The semantics (names, help text, roles, reading and focus order,
announcements, decoration) are ux's, from `design-ux-flow`; the builder
implements them through the platform's accessibility APIs. The designer draws:

- focus, always visible;
- AA contrast in every theme;
- large text, and high contrast;
- reduced motion.

## Boards

- Render each component and screen in every theme, every state, at each
  density, window size, device, and orientation the repo supports, from the real themes or the design tool, never a
  hand-drawn mock-up. Where the repo names a tool, the boards are drawn in it.
- Review boards as screenshots; the builder's screenshots must match them.

## Hand-off checklist

A design is ready for a builder when it has:

1. Boards for every theme, state, density, window size, device, and
   orientation, each linked where
   it lives (a view-mode link and an exported PNG for a tool board).
2. Every token cited by name, and each new value added to the value
   authority (the design-system page, or the tool's exported tokens when the
   repo says so), or, where the design tool leads, made in the tool.
3. Per component, the token each state uses in each theme, and whether it is
   templated or drawn.
4. A link to ux's hand-off: the accessible names, roles, focus order, and
   copy keys.
5. The platform conventions followed for each target, and where the design
   system overrides one.
6. Each open behaviour question answered or handed to the specification
   author.
7. The checklist above, ticked, for the builder to build against; the builder
   makes no visual decision and sends a gap back.
