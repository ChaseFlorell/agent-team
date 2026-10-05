---
name: coding-conventions
description: Conventions for any code, test, documentation, or diagram change in a specification-driven repository — orient first, stop on a gap, keep the design direct, protect privacy boundaries, and put a rule where it runs. Use for any change.
---

# Coding conventions

**Project rules.** A project may extend this skill with a companion skill that
names this one; its agent instructions (`AGENTS.md`) list it. Read both. The
companion holds the project's language, framework, and privacy specifics, and
wins where they differ.

## Before implementing

- **Orient**, even when the task looks small or familiar — drift comes from
  skipping this, not from the change itself:
  - the project's code graph or index, when it has one;
  - the specification, the affected canonical pages, and the area's **out of
    scope** section;
  - every ADR that bears on the change;
  - the project's lessons.
- When they conflict, source and tests are current state; ADRs and issues are
  history.
- **Stop on a gap.** If the reading leaves a decision unsettled, or two sources
  in tension, ask before proceeding — even under a "spike" or "just get it
  working" framing. Name the gap, the options, and your recommendation. Never
  resolve it by assumption or by picking the easiest option to build.
- **Specify first.** Say what is out of scope for the area you touched, not
  only what you built.

## Design

- Keep the implementation direct. Use plain code until a real external
  boundary or a second implementation makes an abstraction useful.
- Add an interface only at a real external boundary or when two
  implementations already need a shared contract.
- When a seam is justified, use SOLID and named Gang-of-Four patterns as the
  vocabulary. The seam earns the pattern; naming a pattern never earns the
  seam.

## Design and build

For a role that designs and builds what the cited claims describe. The claims
say *what*; you decide *how*, and prove it.

- **Read first**:
  - the cited claim IDs and their scenarios, and the accepted decisions they
    touch;
  - the code graph or index, before designing: the specification says *what*,
    the graph says what exists, and reinventing an unseen service is the
    commonest failure;
  - the agent instructions, and the project companions of the skills the role
    preloads, which the agent instructions list;
  - these conventions and their companion, and the focused skill for each
    surface touched.
- **Design before code**: the shape of the interface, the data flow, the
  failure modes, and where each piece lives.
  - Reuse over reinvention: cite what the graph showed you.
  - A plan goes to the critic before it is final; a significant or
    hard-to-reverse choice becomes a decision record.
- **Build** the smallest design that satisfies the cited claims, in your own
  worktree, within "Design" above.
- **Tests you own**:
  - unit and integration tests for the code you write;
  - a focused privacy or boundary test on any privacy-sensitive surface the
    project skill lists;
  - the acceptance step definitions belong to the test writer.
- **The report**: the design choices made, the files changed, and the test
  results.

## Privacy

- Protect privacy at every boundary where data crosses: DTOs, storage, model
  calls, logging, review, and publication.
- Use synthetic data only, in tests and docs.
- Never log user content, credentials, or tokens. The project skill lists
  exactly what else never enters a log.

## Diagrams

- Draw every diagram as a Mermaid code block, when the project has chosen
  Mermaid.

## Generated files and guards

- Never hand-edit a generated file.
- **Put a rule where it runs, not only where it is checked.** A convention
  enforced by a CI command-line flag holds only in CI; a local test run, an IDE
  run, or another agent's session escapes it. Enforce it in code, a hook, or
  the tool that owns the artifact; CI is the backstop.
- **A committed generated file merges the way its sources do.**
  - Every line derives from one source item; no whole-tree totals or counts.
  - Independent items are sorted by a stable key and separated by unchanged
    lines, so git's merge of two correct copies is correct.
  - A count belongs in the generator's output or a CI job summary.

## Before finishing

- Run the narrowest relevant checks.
- Inspect the diff for unrelated changes.
- Update the specification whenever the target design changes.
