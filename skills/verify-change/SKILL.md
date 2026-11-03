---
name: verify-change
description: How to verify a change with evidence only — reproductions that ran, mechanical checks with their bounds and counterexamples, no finding without one, and probes kept out of every repository. Use when proving or disproving a diff, a contract, or a bug before it merges.
---

# Verify change

**Project rules.** A project may extend this skill with a companion skill that
names it; its agent instructions (`AGENTS.md`) list it. Read both. The
companion holds the project's paths, commands, and boundaries, and wins where
they differ.

Findings follow `review-work`.

## Empirical

- Reproduce before reporting.
- Each finding records a runnable command and the output observed.

## Formal

- State the invariant precisely.
- Check it mechanically with the strongest tool the project already has, in
  this order: type checker, property-based test, model checker, static
  analyser.
- Record the tool, the bound checked (input space, depth, seed), and the
  counterexample.
- A bounded check is reported as bounded, never as proved.

## Drop rule

- No repro and no counterexample, no finding.
- No nitpicks, no "consider".
- Security and privacy are in scope only when demonstrated.

## Budget

- Probe only the changed code and the contracts it touches.
- Stop when each has a counterexample or a passing check.

## Probes never reach a repository

A hook enforces this.

- Every probe lives in a scratch directory outside every git work tree, made
  with `mktemp -d`, and deleted after reporting.
- A probe that must sit inside the project to run (a test runner that only
  finds in-tree files) is reported as a test delta instead.
