---
title: Lessons
description: What a lesson records, its three kinds and what each owes, when to write one, and where the generated index of lessons lives.
type: guide
---

# Lessons

A bug is usually a gap in the specification: no claim covered the case, or a
claim covered it wrongly. Fixing only the code leaves that gap where it was.
A lesson records what the specification should have said, and is read on a
design pass alongside the feature files and the decisions — not looked up
after something breaks.

## When to write one

A bug fix that reveals a specification gap writes a lesson in the same pull
request as the fix. A fix that reveals nothing — a typo, a dependency bump, a
rename — does not.

A lesson does not replace an ADR or a scenario. A fix that also makes a
durable architectural decision still gets an ADR, and the lesson cites it. A
fix that changes user-facing behaviour still gets a scenario, and the lesson
cites its claim ID.

## Three kinds, and what each owes

| `kind` | About | Remedy | Required sections |
|---|---|---|---|
| `product` | what the system does | a claim: `## Spec delta` names a `REQ-` or `CON-` ID | all five |
| `process` | how we work: tooling, CI, hooks, delivery, what an agent does | a skill or convention, updated in the same pull request; `## Skill` names it | all five |
| `incident` | an operational postmortem: a deploy, an account, a provider failed | what happened and why | Symptom, Root cause |

A product lesson changes no skill: restating product behaviour in a skill
creates a second place for it to drift. A process lesson that stops at the
lesson is a story, not a rule; agents read skills, not this index. An
incident may name a skill it changed; never invent a rule to give it one.

## The shape

One file per lesson, `NNNN-<slug>.md`, numbered in the order written. The
body has these sections, in this order, and no others; more detail is a `###`
under one of them:

- **Symptom** — what was observed, in the terms it was observed in.
- **Root cause** — why it happened, not which line was edited.
- **Spec delta** — what changed upstream: the claim added or corrected, the
  ADR written, the guard moved.
- **Scenario** — the claim ID that now proves it, or an explicit statement
  that no scenario can.
- **Skill** — for a process lesson, the skill or convention that now carries
  the general rule. A product lesson writes "None — the claim is the remedy."

`sdd.ts new lesson "<title>" --issue <N> --kind <kind>` creates one;
`sdd.ts check` holds it to this shape. A lesson that turns out wrong is
corrected in place or marked `superseded`; unlike an ADR, a lesson may be
edited.

## Index

Every lesson, newest first, is in the generated
[specification index](../README.md#lessons). Its "What it cost us" column is
the lesson's `description`, and its "Remedy" column the claims under
`## Scenario` and the skills under `## Skill` — write those carefully; there
is no table to fill in by hand.
