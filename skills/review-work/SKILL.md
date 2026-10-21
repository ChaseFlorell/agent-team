---
name: review-work
description: What every reviewing role shares — read-only, one finding per line as path:line, severity, problem, fix, severities blocker, major, and minor, evidence for each finding, and a clean pass stated plainly. Use when reviewing a plan, a diff, or a working tree.
---

# Review work

**Project rules.** A project may extend this skill with a companion skill that
names it; its agent instructions (`AGENTS.md`) list it. Read both. The
companion holds the project's paths, commands, and boundaries, and wins where
they differ.

This skill holds only what reviewers share. Each reviewer's own lens, and any
bound on how often it runs, belongs to that reviewer.

## Read-only

- A reviewer never edits, formats, or commits anything. It reports; the author
  changes.
- Run read-only commands to prove a finding. Never run one that changes state.

## Read before judging

- The work under review, and the need, issue, or claims it answers.
- A diff: every caller and every contract the changed code touches (signatures,
  schemas, wire formats, persisted shapes), and the tests the change adds or
  leaves untouched.
- A plan: the specification, the accepted decision records, the product
  invariants, and the out-of-scope lines of each area it touches; the code
  graph or index, for what already exists.
- A whole repository at rest: the specification, the decision records, the
  lessons, the conventions, the docs, the instruction files, and the code they
  describe. Run the project's own checks read-only and cite them. Report a
  contradiction or a duplicate at both locations.
- A diff judged against claims: the cited claim IDs with their scenarios, the
  accepted decisions they touch, the area's out-of-scope section, and the
  traceability matrix for what else the changed code is claimed to satisfy.

## Board review

Reviewing a UI change against its boards:

- Open each cited board link; judge the build against the board, and the
  board against the design system.
- **Token binding**: a colour, size, spacing, radius, font, or duration set
  as a raw value on a property a token can bind is a finding, on a board and
  in the build. Evidence is the board and property, or the file and line.
- A board the repo's design tool should hold but that exists only as a file,
  or a hand-off with no view-mode link, is a finding.

## The finding line

- One line per finding, nothing else: `path:line, severity, problem, fix`.
- A plan or a claim has no line. The location is then the file, claim, or
  decision record the finding cites.
- Severity is `blocker`, `major`, or `minor`.
- **Evidence is required**: the file, line, claim, or decision behind the
  finding, or the command output that proves it. A finding without evidence is
  an opinion; leave it out.
- Evidence never quotes user content, personal data, or credentials; cite the
  location, a count, or a shape.

## A clean pass is a result

- Say so plainly. Never invent a finding to look thorough.
