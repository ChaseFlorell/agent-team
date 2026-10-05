---
name: test-from-scenarios
description: Test a specification-driven repository — scenario tags, step definitions written from the scenario, seeded data, external providers, and pinned test containers. Use for test changes or behavior that needs verification.
---

# Test from scenarios

**Project rules.** A project may extend this skill with a companion skill that
names this one; its agent instructions (`AGENTS.md`) list it. Read both. The
companion holds the project's test stack, runners, naming, and the contracts
its tests must cover, and wins where they differ.

## Data

- Synthetic fixtures only; never real personal data.
- Deterministic fakes at model and service boundaries.
- A rule over seeded rows is tested against the rows the migrations seed,
  loaded from the migrated database, never against a stand-in built with a
  domain factory. A seeded row can differ from the factory's in key, flags, or
  wording, and a test on the stand-in proves nothing about the real one.

## Scenarios

### Which runner

- A scenario that asserts browser-observable behavior carries a tag (such as
  `@ui`) and runs in the browser runner; the server-side runner skips it
  itself, through a hook, wherever its tests run. A CI filter is a backstop,
  not the mechanism.
- A scenario mixing a client-observable and a server-authoritative assertion
  splits into one browser scenario and one server scenario.
- Most server scenarios call the domain directly — no host, no database.
  Scenarios about what the API **refuses** boot it instead: a domain call
  cannot show "the API rejects it regardless of the UI". Boot the host on first
  use, so a domain-only run pays nothing.

### Shape

- One behavior per scenario: at most one When, never after a Then, and no more
  steps than the small cap the project sets. A later action is a new scenario with a new ID.
- Steps say what a reader observes, in the glossary's words: never a status
  code, a table or column, a route, a transport term, or a reason. The step
  definition keeps the detail.
- No click, press, typing, element role, selector, or pixel in a step; a key is a noun phrase
  in an Examples cell.
- A claim ID is stable: never reused or renumbered, not even when its scenario
  moves to another area.
- A renamed step renames its step definition's text in the same commit.

### `@ignore`

- **`@ignore` means "not built yet", never "no longer true."**
- A scenario may lead its code: it merges `@ignore`, naming the open issue
  that will build it, and that issue does not close while the scenario is
  still `@ignore`.
- Implementing a scenario means writing its step definitions and removing
  `@ignore` in the same pull request. Never leave a scenario un-ignored and
  unimplemented.
- **A built scenario counts only when it passes in a run.** One that fails,
  is skipped at run time, or never runs — filtered out, or in a suite nobody
  runs — is not covered, whatever its tags say.
- **A decision that supersedes a scenario deletes it**, in the pull request
  that records the decision. Parking it behind `@ignore` leaves the repository
  stating something false — a feature file contradicting an accepted
  decision. Git history keeps the text.

### Step definitions

- **Read first**: the scenario, by claim ID, in its area's feature file — that
  text is the specification, and you need not have seen the conversation
  behind it — and the area's supporting page (tables, validation order, DTO
  shapes).
- **One step definition per step**, in the runner the scenario's tags select.
- **A Then's definition asserts and never acts.** A key comes from its Examples
  cell, never from the step.
- **A red test**: run it. It fails on the behavior, not on a missing binding or
  a typo.
- **Write from the scenario, not the conversation.** A binding that needs a
  fact the scenario does not state means the scenario is incomplete — amend it
  rather than encoding the fact in test code.
- **A step that asserts nothing proves nothing.**
  - An empty `Then` is allowed only when an earlier step in the same scenario
    already made that assertion.
  - Never point at another suite ("covered by the API tests"). Prove it here,
    or remove the sentence.
  - A claim proven only against a domain method does not prove the endpoint
    calls it. When the scenario describes what a submission or request does,
    one binding goes through the booted host.
- **Cucumber Expressions are not regex.**
  - Parentheses mean optional text: `(A|B|C)` matches nothing and the scenario
    reports pending. Use `{word}`.
  - A literal `/` is alternation; escape it as `\/`.

## Authentication

- Mint a real token through the booted host; never fake a principal.
- Cover every role at every protected endpoint, and refusal of an unsigned,
  foreign-key-signed, tampered, expired, wrong-audience, or `alg: none` token.

## External providers

- The expected value of what a provider is sent (a language code, a model
  parameter, a request field) comes from the provider's documentation, never
  from the code under test.
- Exercise every direction a provider is called in — for a translator, each
  source and target language, not only the common one.
- Never assert exact generated model prose beyond the strict schema and
  required phrases.

## Test containers

- Pin each image to a version, from an upstream that is still maintained and
  publishes CI's architectures. A pinned tag guards against change, not
  disappearance.
- A pull that fails in CI but passes locally: suspect the local cache first.
  `docker rmi` and pull again, or query the registry's token endpoint
  anonymously, before blaming the change.
- Pin each emulator image once, in one shared place.
