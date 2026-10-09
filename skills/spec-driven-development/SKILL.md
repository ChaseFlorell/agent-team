---
name: spec-driven-development
description: How a repository does specification-driven development — the artifact chain, the .spec directory, Gherkin feature areas with stable claim IDs, constraint pages, decision records, conventions, lessons, the glossary, the generated index and traceability matrix, and the deterministic generator that creates and checks every one of them. Use when starting a project on this method, adding or changing behaviour, or writing a scenario, ADR, convention, or lesson.
---

# Spec-driven development

**Project rules.** A project may extend this skill with a companion skill
that names it; its agent instructions (`AGENTS.md`) list it. Read both. The
companion holds the project's runners, step-definition directories, and extra
checks, and wins where they differ.

**The generator.** `scripts/sdd.ts` beside this file creates every file the
chain reads and checks every rule below. `$SDD` means
`node <this skill's directory>/scripts/sdd.ts`. Never hand-write a record,
area, or generated file the generator can produce; never hand-edit a
generated one.

| Command | Does |
|---|---|
| `$SDD init --project "<Name>"` | creates the layout below; never overwrites |
| `$SDD new feature <area> --prefix <AREA> --title "<Title>"` | a feature area: `.feature`, README, area-paths entry |
| `$SDD new page <slug> --prefix <PAGE> --title "<Title>"` | a constraint page |
| `$SDD new adr "<title>" [--deciders "<names>"]` | a decision record, next number; deciders default to the git user |
| `$SDD new convention "<title>"` | a convention, next number |
| `$SDD new lesson "<title>" --issue <N> --kind <kind>` | a lesson, next number |
| `$SDD next-claim <area>`, `$SDD next-adr` | the next unused ID, counting every remote branch |
| `$SDD generate [--check]` | writes the index, matrix, and claims data; `--check` fails on a difference |
| `$SDD check` | every structural rule ("Checks" below) |
| `$SDD coverage --base <ref> --body <file>` | a pull request's scenario coverage ("Coverage" below) |

Every command takes `--root <dir>` (default `.spec`) and runs from the
repository root.

## The chain

Behaviour flows through tracked files, and every hop is one:

```
need (issue)
  → scenario            .spec/features/<area>/<area>.feature
  → supporting detail   .spec/features/<area>/README.md, .spec/<page>.md
  → step definitions    the project's step-definition directories
  → code                the project's source
```

A bug flows back up the same chain as a lesson. A durable choice between
designs is a decision record. A rule about how the repository is worked on
is a convention.

## Rules (not discretionary)

1. **Specify before implementing.** Author or amend the scenario first, in
   the same pull request as the code that makes it pass.
2. **Correct the specification, not the chat.** When code does the wrong
   thing, first ask whether the scenario said the wrong thing; fix it there
   and re-run the chain. A correction argued in conversation leaves no
   artifact.
3. **The specification delta is the change.** A behaviour-changing pull
   request names what it changed upstream and cites the claims it satisfies.
4. **Say what not to build.** Every area README has an `## Out of scope`
   section; a new boundary is written there, not only in the pull request.
5. **Use the glossary's words.** One canonical word per concept; the
   glossary lists the synonyms a scenario may not use, and `check` refuses
   them.
6. **Steps describe behaviour, not implementation.** No status code, storage
   name, transport term, endpoint, or reason in a step.
7. **One behaviour per scenario.** One When, at most 8 steps, no browser
   mechanics, a key named only in an Examples cell, and a Then that asserts
   without acting.
8. **A feature file and an accepted decision never contradict each other.**
   A change to one that affects the other updates both in the same pull
   request. A contradiction found later is fixed at once by correcting
   whichever is wrong.
9. **Each rule is stated once.** Its scenario, constraint, decision, or
   convention is the home; everything else links to it. No hand-written
   status page: a gap is an `@ignore` scenario or an open issue.
10. **Every diagram is Mermaid.** In an area README, constraint page,
    decision, convention, or lesson, a diagram is a fenced ```` ```mermaid ````
    block — never an image, an external diagramming link, or ASCII art.
    `check` fails an image or a non-Mermaid diagram fence.

## Layout

The specification lives in `.spec/` at the repository root, tooling-facing
like `.github/`. `$SDD init` creates it:

```
.spec/
  README.md                 generated index: the legend to every file below
  traceability.md           generated matrix: every claim and constraint
  claims.json               generated data behind the matrix
  area-paths.json           which source paths each feature area owns
  glossary.md               the vocabulary, with banned synonyms
  system-overview.md        constraint page: purpose, boundaries, out of scope (CON-SO)
  testing-and-quality.md    constraint page: test strategy and gates (CON-TQ)
  features/
    README.md               authority rules, product contract, guardrails
    <area>/<area>.feature   the scenarios
    <area>/README.md        supporting detail and out of scope
  decisions/
    README.md               what an ADR is, lifecycle, missing numbers
    ADR-NNNN-<slug>.md
  conventions/
    README.md
    CONV-NNN-<slug>.md
  lessons/
    README.md
    NNNN-<slug>.md
```

A page lives in `.spec/` when the chain reads it: it carries scenarios,
`CON-*` IDs, a decision, a convention, or a lesson. A guide that explains how
— setup, deployment, status — lives in `docs/`.

## Identifiers

| Thing | ID | File | Heading |
|---|---|---|---|
| Claim (scenario) | `REQ-<AREA>-NNN`, as the tag `@REQ-<AREA>-NNN` | in `<area>.feature` | — |
| Constraint | `CON-<PAGE>-NNN` | on a constraint page | `**CON-<PAGE>-NNN**` |
| Decision | `ADR-NNNN` | `decisions/ADR-NNNN-<slug>.md` | `# ADR-NNNN — <title>` |
| Convention | `CONV-NNN` | `conventions/CONV-NNN-<slug>.md` | `# CONV-NNN — <title>` |
| Lesson | `NNNN` | `lessons/NNNN-<slug>.md` | `# Lesson NNNN — <title>` |

- An ID is never reused or renumbered. A deleted scenario leaves a gap.
  Rewording keeps the ID; genuinely different behaviour is a new claim.
- A number is taken after rebasing onto the default branch, by the
  generator, never assumed: `$SDD next-claim <area>`, `$SDD next-adr`, and
  `new …` for the rest. The generator counts every remote branch, because a
  number chosen when work starts is gone once another branch merges.
- `<AREA>` and `<PAGE>` are short upper-case codes an area or page declares
  once: an area README's `prefix: REQ-<AREA>`; a page's code is whatever its
  `CON-<PAGE>-NNN` bullets use, one code per page. No two areas share a
  prefix.
- A scenario that moves to another area keeps its ID. The receiving area
  lists the foreign prefix in its README frontmatter: `keeps: REQ-<OTHER>`
  when another area still issues it, or `keeps: REQ-<OLD>=NNN` when the
  prefix retired with a split, `NNN` being the last number it ever issued.
  A kept prefix issues nothing new; `check` fails a claim above a retired
  prefix's last number, and `next-claim` issues only under `prefix:`.

## Frontmatter

Every markdown file under `.spec/` opens with YAML frontmatter carrying
`title`, `description`, and `type`. The `description` is one sentence; the
generated index shows it, so write it for a reader choosing where to look.

| `type` | Where | Adds |
|---|---|---|
| `spec` | an area README, a constraint page, the glossary, the features index | `area`; an area README also `prefix` and optionally `keeps` |
| `adr` | `decisions/ADR-*.md` | `status`, `date`, `decision-makers`, `keywords` |
| `convention` | `conventions/CONV-*.md` | `status`, `date` |
| `lesson` | `lessons/NNNN-*.md` | `date`, `issue`, `status` (`accepted` or `superseded`), `kind` |
| `guide` | the decisions, conventions, and lessons READMEs; the generated matrix | — |
| `readme` | the generated index | — |

## Feature areas

One directory per area under `features/`, named in kebab-case for what the
user does there, holding `<area>.feature` and `README.md`. An area past
about 800 lines of Gherkin is split; its scenarios keep their IDs.

### The `.feature` file

```gherkin
Feature: Orders
Customers place an order from their basket and see its progress.

@REQ-ORD-001
Scenario: A customer places an order from a non-empty basket
  Given a customer has two items in their basket
  When the customer places the order
  Then the order is confirmed to the customer
  And the basket is empty

@REQ-ORD-002
@ignore @issue-42
Scenario: An order for an item that sold out is refused
  Given a customer has an item in their basket that has since sold out
  When the customer places the order
  Then the order is refused as invalid
  And the customer is told which item sold out

@REQ-ORD-003
@ui
Scenario: The order page shows each line with its price
  Given a customer placed an order with two items
  When the customer opens the order
  Then each item is shown with its quantity and price
```

- `Feature:` title, then one to three lines on who acts and what they get.
  Optional `Background:` and `Rule:` blocks.
- **Tags.** Exactly one `@REQ-<AREA>-NNN` per `Scenario` or
  `Scenario Outline`; an outline's `Examples` share it. `@ignore` with
  exactly one `@issue-<N>` marks a scenario merged ahead of its code; both
  come off in the pull request that binds it. `@ui` marks browser-observable
  behaviour that runs in the browser runner.
- **Steps.** Declarative Given/When/Then naming the actor, the one action,
  and what is observed. Quote an interface string exactly as the user sees it.
  A refusal uses a glossary outcome phrase (`is refused as invalid`), never a
  code. A key or pointer is named only in an Examples cell, as a noun phrase.
  Scenario style beyond this: the `cucumber-best-practices` skill.
- **An obsolete scenario is deleted**, never parked; its ID is never reused.
- A new area may hold no scenario until its first claim is written.

### The area README

`type: spec`, `area: <area>`, `prefix: REQ-<AREA>`. Opens by linking the
feature file and the decisions behind the area, then holds only what Gherkin
cannot: tables, validation order, a state diagram, where a number comes from.
Never a restated scenario. Ends with `## Out of scope`: what not to build
here, each with the issue or decision that ruled it out.

### Area paths

`area-paths.json` maps behaviour-bearing source paths to areas: `every`
lists paths every area depends on; `areas.<area>` lists globs the area owns.
A new area, and a new source file, is mapped there in the same pull request.
`coverage` reads it to judge whether a pull request's scenarios relate to its
code.

## Constraint pages

A `type: spec` page directly under `.spec/` holding `**CON-` bullets, for
requirements no scenario can run: a boundary, a data shape, a deployment
topology, a testing obligation. `system-overview.md` (purpose, components,
non-negotiable outcomes, out of scope) and `testing-and-quality.md` (test
strategy, gates) exist from `init`; `$SDD new page <slug> --prefix <PAGE>
--title "…"` adds another, such as data-and-persistence,
interfaces-and-data-flow, or infrastructure-and-operations.

Each normative statement is one bullet:

```markdown
- **CON-ORD-003** A cancelled order is never returned by any read a customer can make.
  *Verified by: REQ-ORD-004, REQ-ORD-011.*
- **CON-TQ-001** Tests protect user-visible contracts, not internal structure.
  *Verified by: none — a rule about the suites, not about what the system does.*
```

Prose around the bullets describes; only a bulleted `CON-*` requires. The
`*Verified by:*` line may add prose after its IDs; only the `REQ-` and `CON-`
tokens are checked.

## Glossary

`glossary.md` holds one table per concept group with the columns **Term**,
**Definition**, **Banned in scenarios**, optionally **Exempt areas**, and a
table of outcome phrases a Then uses in place of a status code. A banned
item is a backticked whole-word phrase, matched ignoring case, or a
`/pattern/flags` regular expression; an exempt area, by directory name, is
where that row's bans do not apply. `check` refuses a banned synonym in any
`.feature` file or area README, outside `"double quotes"`, `` `code` ``, and
`<placeholders>`. A new concept is added to the glossary in the pull request
that first names it.

## Decisions

An ADR records architecture: a technology, a boundary, a data shape, a
durable trade-off with a rejected alternative. Not an ADR: a routine detail
with no alternative, a restated scenario, interface detail (a scenario), or
a process rule (a convention).

- `$SDD new adr "<the decision, as a sentence>"` after a rebase: next number,
  slug, `templates/adr.md` filled in. Sections, in this order and no others:
  `**Status:**` line, `## Context`, `## Decision drivers` (optional),
  `## Considered options` (required — a decision with no alternative worth
  naming says so there), `## Decision`, `## Consequences`, `## Related`
  (optional).
- Statuses: `proposed` (may change freely), `accepted`, `rejected`,
  `deprecated`, `superseded`. The frontmatter `status:` and the
  `**Status:**` line agree; the line opens with the status word.
- **An accepted ADR is immutable.** Only its status changes, and a link's
  target when its file moves. A change is a new ADR that supersedes the
  whole old record and lists what of it still holds, by link or claim ID,
  never restating it. The old record's status line links the successor. No
  amendments, no rewrites, no deletions; a typo stays.
- An ADR that changes a feature file's assertion updates the feature file in
  the same pull request, and marks any ADR it reverses superseded.
- An ADR that changes a technology or how the system is broken up also
  updates the root `README.md`: the fact and the link, not the rationale.

## Conventions

A convention is a living rule about how the repository is worked on —
tooling, CI, hooks, delivery, what an agent does. `$SDD new convention "<the
rule, as a sentence>"`: `## Rule` (imperative bullets), `## Why` (the issue,
lesson, or ADR behind it), `## Enforced by` (optional: the tool or hook, or
"written, not checked"). Edited in place when the rule changes; `status:
superseded` when another convention or an ADR replaced it. A skill states the
rule by topic; the always-loaded instructions link the convention.

## Lessons

A bug fix that reveals a specification gap writes a lesson in the same pull
request; a fix that reveals nothing writes none. `$SDD new lesson "<title>"
--issue <N> --kind <kind>`. Sections, in order and no others: `## Symptom`,
`## Root cause`, `## Spec delta`, `## Scenario`, `## Skill`.

| `kind` | Remedy | Owes |
|---|---|---|
| `product` | a claim: `## Spec delta` names a `REQ-` or `CON-` ID that exists; `## Skill` says "None — the claim is the remedy." | all five sections |
| `process` | a skill or convention updated in the same pull request; `## Skill` names it | all five sections |
| `incident` | a postmortem of the running system; may name a skill it changed | `## Symptom`, `## Root cause` |

A lesson may be edited or marked `superseded`. Lessons are read on every
design pass, alongside the feature files and the ADRs.

## Generated files

`$SDD generate` writes three files from the tree; `$SDD generate --check`
fails when a committed one differs. Every row derives from one file, with no
whole-tree total, so parallel branches merge them cleanly.

- **`README.md`** — the index and legend. One table per kind: areas (claim
  prefix, scenario, planned, and browser counts, README description),
  constraint pages (prefix, count, description), decisions (number, title,
  status, date), conventions (the same), and lessons (number, title, what it
  cost us, remedy, issue, date, status, kind), newest first. An agent asked
  where a rule lives reads this file first.
- **`traceability.md`** — one row per claim (scenario, area, engine,
  `Planned` or `Built`) and per constraint (page, verified by). The engine
  is `browser` for an `@ui` scenario and `application` otherwise.
- **`claims.json`** — the same as data: areas with prefixes, claims with
  their steps and tags, constraints, decisions, and lessons with what each
  cites.

Regenerate before every commit that touches `.spec/`; a duplicate, malformed,
or missing ID fails there, not in review. A project that binds claims to
step-definition files extends `claims.json` with its own tool.

## Coverage and exemptions

A behaviour change is covered by a scenario or cites the claims it
preserves. `$SDD coverage --base <ref> --body <pull-request-body>` fails a
diff that changes a file mapped to an area without changing a scenario's
text in a mapped area, unless the body carries, at line start:

```
No .feature scenario needed: refactor — split the pricing module in two; every order still prices as before
Claims preserved: REQ-ORD-001, REQ-ORD-004
```

The category is one of `refactor`, `styling`, `dependency`, `test-only`,
`build`, `revert`, `docs`; the claims exist and sit in mapped areas. Never
use it because the scenario is slower to write. Cannot name the preserved
claims? The change needs a scenario. A project that lets a manifest-only
diff (lock files, package manifests) through without a citation adds that
rule in its companion skill and its own check.

## Workflows

### Start a project

1. `$SDD init --project "<Name>"` in the repository root. Never overwrites.
2. Fill in `features/README.md`: the product contract paragraph and the
   simplicity guardrails. Fill in `system-overview.md` and
   `testing-and-quality.md` with the first constraints.
3. Seed `glossary.md` with the roles and things the product names.
4. `$SDD new feature <area> --prefix <AREA> --title "<Title>"` per area the
   first need touches, then write its first scenarios as `@ignore
   @issue-<N>` against open issues.
5. Record the founding architecture choices, one `$SDD new adr` each.
6. Paste `templates/agents-section.md` into `AGENTS.md` and link the index.
7. `$SDD generate`, then `$SDD check`; hand wiring both into pre-commit and
   CI ("Checks" below) to backend. Commit.

### Add or change behaviour

1. Read: the index, the area's feature file and README, every ADR it links,
   the lessons. A genuinely ambiguous need goes through the
   `clarify-requirements` skill; the answer is written back as a scenario
   or an out-of-scope line, never left in the chat.
2. Write or amend the scenario, ID from `$SDD next-claim <area>`; `@ignore
   @issue-<N>` if it merges ahead of its code. Add the out-of-scope line
   wherever someone could over-deliver; supporting detail to the README.
3. Record the decision as an ADR if one was made; map new source files in
   `area-paths.json`.
4. Bind the steps (the `test-from-scenarios` skill), build, make it pass,
   remove `@ignore` and `@issue-<N>`.
5. `$SDD generate && $SDD check`. The pull request body names the
   specification delta and the claims satisfied; `$SDD coverage` passes.

### Fix a bug

1. Ask what the specification should have said. Correct or add the
   scenario; it fails before the fix and passes after.
2. `$SDD new lesson` with the kind that fits; a process lesson also updates
   the skill or convention that would have prevented it.
3. The rest as "Add or change behaviour".

## Checks

`$SDD check` is the whole structural rule set, deterministic and
dependency-free; the exit code is the contract. It fails:

- a markdown file under `.spec/` without frontmatter, a missing or empty
  core key, a `type` the path contradicts, a missing per-type key, or a
  template placeholder (`<like this>`) left in a title, description,
  heading, or ADR status line;
- an area without `<area>.feature` or `README.md`, without a `prefix`, or
  with a prefix another area declares; an area missing from
  `area-paths.json`, or an entry naming no area;
- a scenario with no claim tag or more than one, a duplicate or malformed
  ID, a prefix no area declares or keeps, a number above a retired prefix's
  last, `@ignore` without exactly one `@issue-<N>`, or `@issue-<N>` without
  `@ignore`;
- a scenario breaking rules 5–7: more than one action step, more than 8
  steps, browser mechanics, a status code or transport term, or a banned
  glossary synonym (also in an area README);
- a constraint page with a duplicate or malformed `CON-*` ID, two pages
  sharing a code, a constraint with no `*Verified by:*`, or one naming a
  claim that does not exist;
- an ADR off "Decisions": filename, number, and heading disagreeing,
  `status:` and `**Status:**` disagreeing, sections missing, extra, or out
  of order, an amendment, or `superseded` or `deprecated` without a linked
  successor;
- a lesson or convention off its shape, a lesson whose kind owes what its
  sections lack, or a product lesson naming a claim that does not exist;
- a relative link that resolves to nothing, an `#anchor` no heading matches,
  an image, or a `plantuml`, `dot`, `graphviz`, `ascii`, or `diagram` fence;
- a generated file that differs from what `generate` writes.

Run it in the pre-commit hook and in a required CI job, with
`$SDD generate --check`; backend wires both, never the specification author.
A rule that runs only in CI is found on the pull request, not before it. The project's own tools — step-definition binding,
claim results per run, link checks across `docs/` — extend these; they
never replace them.

## Related skills

- `deliver-change`: the issue, worktree, pull request, and review steps
  around this chain.
- `clarify-requirements`: a genuinely ambiguous need.
- `test-from-scenarios`: binding a claim to a step definition.
- `cucumber-best-practices`: Gherkin scenario style.
- `write-agent-instructions`: the always-loaded instructions that link the
  index, and the companion skill that names the project's runners.
