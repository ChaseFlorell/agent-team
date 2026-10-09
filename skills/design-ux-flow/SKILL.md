---
name: design-ux-flow
description: Specify the user experience on any platform before it is designed or built — the interaction flow, accessibility semantics, and localized copy in every supported language, and the written hand-off to the designer and the builder. Use when designing or changing how a screen, component, or feature flows, is announced to assistive technology, or reads.
---

# Design the user experience

**Project rules.** A project may extend this skill with a companion skill that
names it; its agent instructions (`AGENTS.md`) list it. Read both. The
companion holds the project's locale catalogues, supported languages, and
copy conventions, and wins where they differ.

Platform-neutral: the flow, the semantics, and the copy hold on the web, a
native desktop, and mobile alike. The builder maps them to the platform.

## Read first

- The cited claims and the decisions they touch.
- The existing flows, components, and locale catalogues: reuse a pattern and
  a string before inventing one.
- Never invent behavior the claims lack; ask, or hand it to the specification
  author.

## The flow

- What the user does, in what order, from entry to exit.
- What happens on every outcome: success, error, empty, loading, cancel, and
  a repeated or interrupted action.
- Every action reachable by keyboard, pointer, and touch, where the platform
  has them.
- The smallest flow that satisfies the cited claims.

## Accessibility semantics

State what assistive technology must get, not the platform call that does it:

- an accessible name for every control, and help text where useful;
- the role, value, and state of every custom control;
- reading order and focus order, and where focus moves after each action,
  including into and out of a dialog;
- what is announced, and when: errors, progress, and results;
- decoration hidden from assistive technology;
- what must hold under large text, reduced motion, and high contrast.

## Copy

- Every user-facing string and accessible label has a key and a value in every
  supported language.
- Write whole sentences with placeholders, never joined fragments; give plural
  and gendered forms their own variants.
- Expect text to grow in translation; flag a string that must stay short.
- Error copy says what happened and what to do next.
- Write the entries into the locale catalogues. That is the only repository
  file this skill's owner edits.

## Hand-off

The builder makes no UX decision: whatever the hand-off omits is a gap the
builder sends back. A written hand-off in the issue or pull request, per
target platform, is complete for the designer and the builder when it has:

1. The flow: every step in order, and every state of each screen and
   component with how it is entered and left, including error, empty, and
   loading.
2. The focus order, and the keyboard and pointer or touch path for each
   action.
3. The screen-reader semantics per screen and component: names, roles,
   reading order, announcements, and where focus moves after each action.
4. The copy keys, each with a value in every supported language.
5. Each open behavior question answered or handed to the specification
   author.
6. A checklist of the above that the builder ticks against the build.

## Report

- The flow, semantics, and copy choices made.
- The catalogue entries added or changed.
