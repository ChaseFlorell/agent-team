---
name: research-records
description: How to research the record before work starts — search open and closed issues and pull requests wide, read each hit's comments and timeline deep, compare against open defects, look up the specification, and return a cited dossier that ends in one piece of advice. Use when asked whether an issue already exists, was decided, or should be filed, extended, reopened, or marked a duplicate.
---

# Research records

**Project rules.** A project may extend this skill with a companion skill that
names it; its agent instructions (`AGENTS.md`) list it. Read both. The
companion holds the project's paths, commands, and boundaries, and wins where
they differ.

Read-only throughout. Report what exists; never file, comment, label, or link.

## Search wide

- Search issues and pull requests, **open and closed, always both**:
  `gh search issues`, `gh search prs`, `gh issue list --state all`.
- Try several phrasings and synonyms, the error text, and file and symbol
  names. Record every query tried.
- `gh api search/issues -f q=…` needs `-X GET`; without it the call is an
  implicit POST and the command guard blocks it.

## Read deep

- For each hit read the body, every comment, and the timeline (cross-references,
  duplicate marks, closing pull request, reopenings).
- Read linked pull requests and their review threads.
- Relations by REST GET only: `/issues/N/timeline`, `/issues/N/sub_issues`,
  `/issues/N/parent`, `/issues/N/dependencies/blocked_by`.
- An endpoint that 404s is a gap. Say so in the dossier; never write "nothing
  found" for a call that could not answer.
- `git log` and `git blame` for when and why the code changed.

## Compare

- Against open defects: same symptom, same code path.
- Classify each overlap as duplicate, overlaps, relates to, or unrelated, in
  `deliver-change` "Relationships" vocabulary.

## Look up the specification

Find whether the ask is already specified, decided, ruled out of scope, or
recorded as a lesson, and cite it (see `spec-driven-development`). Lookup only:
whether a plan conflicts is the critic's judgement.

## Dossier

Plain prose; no persona voice.

- **Question** asked.
- **Queries run**, open and closed.
- **Findings**, each with a link or `path:line`.
- **Decided, tried, or rejected**, and where.
- **Gaps**: what was searched and not found, with the queries; never silence.
- **Advice**, last, exactly one, with its evidence. A closed issue counts as
  much as an open one.
  - `file new`
  - `file new, relates to #N`
  - `file new, blocked by #N`
  - `extend #N`
  - `reopen #N` (closed but not fixed, or regressed)
  - `duplicate of #N`
  - `already decided — see <record>` (closed as won't-fix, or a decision rules
    it out)
