---
title: {{project}} specification
description: "The canonical target design: the authority rules, where the specification index lives, and the product contract."
type: spec
area: index
---

# {{project}} specification

`{{root}}/` is the canonical specification of the target system. This
directory, `{{root}}/features/`, holds every behaviour-describing page as a
Gherkin `.feature` file (Given/When/Then), each with a `README.md` beside it
for the detail Gherkin cannot hold: tables, validation order, diagrams, and
what not to build. A `{{root}}/features/<area>/` directory always holds a
`.feature` file; a page of normative constraints with no runnable scenario
sits one level up, in `{{root}}/`.

A scenario without `@ui` runs in the project's Gherkin runner; one tagged
`@ui` asserts browser-observable behaviour and runs in the browser runner. An
unbuilt scenario carries `@ignore` and one `@issue-<N>` tag naming the open
issue that will build it, so a scenario may merge ahead of its code; building
it means binding its steps and removing both tags in the same pull request.

## Authority and conflict rules

1. This specification defines the target design.
2. Source and tests show what is implemented today; they never silently
   override the target.
3. Issues and decision records preserve history and rationale. A contradictory
   issue, guide, prompt, skill, test, or implementation is superseded until it
   is aligned with this specification. An accepted decision record is
   different: a feature file and an accepted decision never contradict each
   other, and a contradiction is fixed by correcting whichever is wrong — the
   feature file, or the decision through a new record that supersedes it. A
   change to one that affects the other updates both in the same pull request.
4. A gap is recorded explicitly, as an `@ignore` scenario in the generated
   traceability matrix or an open issue, never in a hand-written status page.
   A target feature is never described as working because its scaffold exists.
5. A decision that changes the design updates the canonical page and the
   affected tests in the same pull request. Each rule is stated once, in its
   scenario, constraint, or decision; everything else links to it.
6. Every user-facing requirement gets a scenario; every durable architectural
   decision gets a decision record under `{{root}}/decisions/`. Neither
   substitutes for the other: a feature file never argues why a technology was
   chosen, and a decision record never restates acceptance criteria.
7. Every scenario carries exactly one stable claim ID tag, `@REQ-<AREA>-NNN`,
   and every normative constraint on a constraint page carries a
   `CON-<PAGE>-NNN` ID naming the claims that verify it. An ID is never reused
   or renumbered. The claims and the traceability matrix are generated from
   these files, never kept by hand.
8. Behaviour is specified before it is implemented, and a wrong behaviour is
   corrected here rather than argued in a conversation. Each area's README
   records what **not** to build in that area; the global boundary in
   [`system-overview.md`](../system-overview.md) still holds, and an area
   section only narrows it.
9. A page lives in `{{root}}/` when the specification chain reads it: it
   carries scenarios, `CON-*` IDs, a decision, a convention, or a lesson. A
   page that explains how — setup, deployment, status — lives in `docs/`.
10. Every diagram in this directory is a fenced `mermaid` block. Never an
    image, an external diagramming link, or ASCII art.

## Specification index

Every feature area, constraint page, decision, convention, and lesson is
listed in the generated [specification index](../README.md), each row read
from its own file. Every claim and constraint, with what verifies it, is in
the generated [traceability matrix](../traceability.md). Scenarios and area
READMEs use the words of the [glossary](../glossary.md).

## Product contract in one paragraph

<One paragraph: who uses the system, what they do, what the system guarantees,
and where the human decisions are. Link the decision records that fix each
guarantee. This is the paragraph a new contributor reads first.>

## Simplicity guardrails

<What the target deliberately does not have, each with the decision that
ruled it out. A new abstraction is justified by a real boundary or a second
implementation, never by a hypothetical future.>
