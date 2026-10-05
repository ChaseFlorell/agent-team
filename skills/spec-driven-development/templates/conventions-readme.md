---
title: Conventions
description: Where process, tooling, and agent-workflow rules live instead of decision records, and the shape each convention takes.
type: guide
---

# Conventions

A convention is a rule about how this repository is worked on — tooling, CI,
hooks, the delivery workflow, what an agent is expected to do. A rule of that
kind is written here, never as an ADR. An ADR records architecture and is
immutable once accepted; a convention is a living rule, edited in place when
it changes, and git keeps its history.

## The shape

One file per convention, `CONV-NNN-<slug>.md`, numbered in the order
written. A number is never reused or renumbered.

Frontmatter: `title`, `description`, `type: convention`, `status`
(`accepted`, or `superseded` when another convention or an ADR replaced it),
and `date` (first accepted).

Body:

- `# CONV-NNN — <the rule, as a sentence>`;
- `## Rule` — the rule, in imperative bullets;
- `## Why` — the reason, with the issue, lesson, or ADR behind it;
- `## Enforced by` (optional) — the tool, hook, or check that holds it.

`sdd.ts new convention "<the rule, as a sentence>"` creates one; `sdd.ts check`
holds it to this shape. The skill agents read for the rule names its topic,
never this file; the always-loaded instructions link the convention, and the
convention holds the reason.

## Index

Every convention, newest first, is in the generated
[specification index](../README.md#conventions).
