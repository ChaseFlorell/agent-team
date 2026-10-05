---
title: Architecture decision records
description: What a decision record is for, its lifecycle, how it relates to the specification, and how a new one is created.
type: guide
---

# Architecture decision records

A decision record (ADR) preserves the reasoning and context that existed when
a decision was made. It is history, not the product-design authority: the
feature files define the target, and a feature file and an accepted ADR never
contradict each other.

## What gets an ADR

Every architectural decision — a technology, a boundary, a data shape, a
durable trade-off with a rejected alternative. Not discretionary; in doubt,
write it. These do not:

- a routine detail with no rejected alternative;
- a restatement of a scenario;
- interface detail — wording, layout, a field's behaviour — which is a
  scenario;
- a process, tooling, or agent-workflow rule, which is a
  [convention](../conventions/README.md).

## An accepted ADR is immutable

- Once accepted, only its frontmatter `status:` and its `**Status:**` line
  ever change, and a link's target when the file it points to moves or is
  deleted (point it at a commit permalink).
- A change to a decision is a new ADR. The record it changes becomes
  `superseded`, its status line linking the successor; the successor lists
  what of the old still holds, by link or claim ID, never restating it.
- No amendment sections. A typo in an accepted ADR stays.
- An ADR is never deleted. A number that went missing is listed below with
  why, and never reused.

## Lifecycle

| Status | Meaning |
|---|---|
| `proposed` | Written, not yet decided. May change freely. |
| `accepted` | Decided. Immutable from here. |
| `rejected` | Decided against; kept for the reasoning. |
| `deprecated` | No longer applies; its status line links the ADR or convention that retired it. |
| `superseded` | Replaced; its status line links the successor. |

An `accepted` record moves only to `superseded` or `deprecated`; those two
and `rejected` are terminal.

## Creating one

`sdd.ts new adr "<the decision, as a sentence>"` takes the next number after
a rebase onto the default branch, names the file `ADR-NNNN-<slug>.md`, and
writes the sections in order: one `**Status:**` line under the heading, then
`## Context`, `## Decision drivers` (optional), `## Considered options`
(required), `## Decision`, `## Consequences`, `## Related` (optional). A
diagram is a fenced `mermaid` block. `sdd.ts check` fails any other shape.

## Missing numbers

None.

## Index

Every decision, newest first, with its status and date, is in the generated
[specification index](../README.md#decisions).
