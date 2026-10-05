---
name: deliver-change
description: Deliver a change through a GitHub issue, worktree, specification, documentation, pull request, and CI workflow shared by several agents. Use when creating or editing issues, docs, worktrees, PRs, or checks.
---

# Deliver a change

**Project rules.** A project may extend this skill with a companion skill that
names this one; its agent instructions (`AGENTS.md`) list it. Read both. The
companion holds the project's tools, commands, and paths for each step here,
and wins where they differ.

## Start

### Claim the issue

- Work from one focused GitHub issue.
- **Never pick up an issue labelled `in progress`** — another agent has claimed
  it, even if it looks stalled or is the obvious next piece. Find work with
  `gh issue list --state open --search '-label:"in progress"'`. Asked for a
  labelled issue by number? Stop and ask the person.
- **Label it `in progress` the moment you pick it up, before anything else** —
  before the worktree, branch, or first edit:
  `gh issue edit <number> --add-label "in progress"`.
  - No exceptions: not for a one-line fix, an issue you just filed, or a
    resumed session. The label is the only thing telling the next agent it is
    taken.
  - Stop without a pull request? Remove it:
    `gh issue edit <number> --remove-label "in progress"`.
  - It stays while a pull request is open; closing the issue takes it off the
    board.

### Settle the requirement before building

- **Put every open question to the person, and record the answers in the
  issue, before writing any code.** A gap, an ambiguity, or a choice between
  two plausible readings is a question, not a decision for you to make. Ask
  it directly, wait for the answer, and write the answer into the issue (see
  "Keep the issue true while you work"). Code built on a guess is thrown away
  when the guess is wrong.
- **A sub-agent brief says to stop and ask.** Any brief handed to another
  agent tells it to stop and report a question rather than build on a guess,
  and the briefing agent has put its own open questions to the person first.
  End the brief with: "if anything is ambiguous, stop and report the
  question; do not guess".
- **Sequence dependent issues.** Issues that edit the same migration, view,
  or table run one after another, in filing order, never side by side: the
  second starts from the first's merged result, so neither rebases onto the
  other's schema. Migration timestamps and view definitions do not survive
  being rebased across each other.
  - Record the order as a blocked-by relation when the issues are filed: the
    second is blocked by the first.
  - Do not pick the second up until the first has merged.

### File a new issue

**Milestone and labels are mandatory — no exceptions.** Pass both on
`gh issue create`, never as a follow-up:

- **Milestone**: exactly one open milestone
  (`gh api repos/{owner}/{repo}/milestones --jq '.[].title'`). An issue carved
  out of a parent takes the parent's milestone.
- **Labels**: every relevant one from `gh label list` — one type, and every
  area and phase label the change matches. The project skill names the
  vocabulary.
- **Verify** with `gh issue view <number> --json milestone,labels` before
  linking or picking the issue up. Missing either? Fix it before anything else.

#### Relationships

**Wire relationships when the issue is created, not later.** Every new issue is
checked against open issues (`gh issue list --state open`) and against every
other issue filed in the same pass. Set each relationship that genuinely
exists, with GitHub's native relations (`gh api graphql`; there is no `blocked`
label), not only prose. A link known at filing and left unset is lost.

- **Filing several issues at once** — splitting a feature, or recording
  follow-ups found mid-change: plan the graph before creating any.
  1. Which issue is the parent, and which are carved out of it (sub-issue)?
  2. Which must land before which (blocked by)?
  3. Which only relate (relates to)?

  Create the parent first, then the children, then wire every relation in the
  same pass.
- **Verify** alongside milestone and labels:
  `gh api graphql -f query='{repository(owner:"<owner>",name:"<repo>"){issue(number:<n>){parent{number} subIssues(first:50){nodes{number}} blockedBy(first:20){nodes{number}}}}}'`.

The relations, strongest first. Use the strongest that is true, never a
stronger one:

- **Blocked by** — only a hard prerequisite: it cannot be implemented or
  verified until another issue lands (a schema, endpoint, DTO, domain method,
  or screen it builds on). Add `addBlockedBy` (`issueId` = new issue,
  `blockingIssueId` = prerequisite), and say `Blocked by #N — <why>` in the
  body's first paragraph. No relation for a soft dependency ("touches similar
  code", "related area").
- **Sub-issue** — only when the new issue is carved out of a larger one being
  split, so the parent's scope shrinks. Use `addSubIssue`. Never link
  independently scoped prerequisites as parent and child; that is `blocked by`,
  and a false hierarchy skews GitHub's completion rollup.
- **Duplicate** — never file a second issue for the same scope. Extend the
  existing one, or, if both must exist, mark the new one `duplicateOf` it.
- When an issue closes or a design change removes a dependency, remove the
  stale relation (`removeBlockedBy`) in the same pass.
- **Relates to** — for a soft link between issues that are neither a
  prerequisite nor a split: a follow-up, a sibling in the same area, the issue
  whose work surfaced this one. Set it rather than leaving the link only in
  prose. It has no API: set it in the issue sidebar, Relationships → "Add
  relates to".

### Worktree and branch

- **Never work on a branch in the primary checkout.** Create a worktree off
  fresh `origin/main`:
  `git fetch origin main && git worktree add -b issue-<number>/<short-description> .claude/worktrees/issue-<number>/<short-description> origin/main`.
  Several agents share the repository; a worktree per issue means none
  switches a branch out from under another.
- **Keep the primary checkout's `main` current, and change nothing in it.**
  Fast-forward it to the remote: `git -C <primary checkout> pull --ff-only origin main`.
  Do this whenever the remote has moved, and after a pull request merges.
  That fast-forward is the only thing ever done there:
  - no edits, commits, restores or resets;
  - no merging or rebasing another branch into it;
  - no generator runs.

  If a pull would not fast-forward, or leaves the tree dirty, stop and tell the
  person rather than repairing it.
- **Check at the first edit, every time.** Before the first `Edit` or `Write`
  for an issue, run `git branch --show-current`. If it says `main`, stop and
  create the worktree. A resumed session, a sequencing detour, or a plain
  "continue" does not look like "starting an issue", which is exactly when this
  gets skipped. Having done it right on an earlier issue proves nothing.
- **Push the branch at once**, from the worktree:
  `git push -u origin issue-<number>/<short-description>`. This also replaces
  the `origin/main` upstream, so a bare `git push` targets the branch.
- **Label the session** in the same step, with the project's session-label
  command, as `#<number> <short-description>`. The person finds the tab that
  owns an issue by this label. Relabel when the pull request opens and when
  checks go green (see "Verify and publish").
- Open every final report to the person with `[#<number> · PR #<pr>]` (just
  `[#<number>]` before the pull request exists), even a one-line report.
- Do all work in the worktree. It comes down once the pull request is open
  (step 8).
- **Never use a bare `git stash` or `git stash pop` in a worktree.** There is
  one stash per clone, shared by every worktree and session: a bare stash
  takes another session's files, and a pop applies whatever entry is on top,
  which may be someone else's.
  - Park work in a WIP commit (`git commit -m "wip"`), and amend or reset it
    later.
  - A stash that cannot be a commit is tagged and applied by SHA:
    `git stash push -m <tag>`, note `git rev-parse stash@{0}`, then
    `git stash apply <sha>`. Never `pop`, `drop`, or `clear`.
  - Nothing enforces this. Git has no pre-stash hook, so no git hook can refuse
    a stash, and the rule is not backed by an agent tool hook either. It is a
    written rule, and agents and people follow it by reading it.

### Commit, rebase, claim identifiers

- **Commit and push each unit of work as soon as it is done** — a scenario, a
  passing test, a step definition, a document. Never hold work for the pull
  request; local-only work is invisible to others and lost with the worktree.
- **Rebase onto fresh `origin/main` before every commit**, not only before a
  push — each unit, the final commit, and each fix while watching checks:
  `git fetch origin main && git rebase origin/main`.
  - Resolve conflicts locally. If the rebase brought in commits, re-run the
    affected checks before pushing.
  - Rewrote commits already on `origin`? `git push --force-with-lease`, never
    plain `--force`.
- **Claim a shared identifier after that rebase**, never from the tree as you
  started — a number, name, slug, or migration timestamp is claimed the moment
  someone else merges it.
  - Take the next ADR number from a tool that counts every fetched remote
    branch, so an open pull request's number is skipped.
  - Lost the race? Take the new number and rewrite every reference; renaming
    is cheap.

### Before editing

- Read the affected specification pages. Update them first if the target
  behavior changes.
- Preserve unrelated work in a dirty tree.

## Document

### Specification directory

- Everything the specification chain reads — scenarios, constraint pages,
  decisions, lessons, conventions, generated matrices — lives under one root,
  apart from guides. The project skill names it.
- An index of specification files is generated from their frontmatter and
  drift-checked in CI, never kept by hand; a hand-kept table falls behind.
- Every relative link in tracked markdown is checked before commit and in CI.
  Moving a file rewrites every reference to it in the same commit.
- The paths live in one module every tool imports; a test ties the copies in
  hooks and workflows, which cannot import it, to that module.
- A generated map ties each claim to the step definitions that bind it. A
  built claim with a step no definition matches fails CI; the specification
  wins, so fix the definition, or the scenario only when it was wrong.

### Scenarios

- Every user-facing requirement has a scenario in a `.feature` file. A change
  that adds or changes behavior adds or updates it in the same pull request —
  mandatory.
- Write the scenario first; when the implementation is wrong, correct the
  scenario, not the conversation.
- The PR body names what changed upstream — scenario, page, boundary — because
  it becomes the squash commit message.
- A scenario may merge ahead of its implementation, marked not built and
  naming the open issue that will build it; that issue does not close while
  the scenario is still unbuilt.
- `@ignore` and superseded scenarios: see
  [`test-from-scenarios`](../test-from-scenarios/SKILL.md) "Scenarios".
- Each area's specification page records what **not** to build. A change that
  draws a new boundary writes it there, not only in the pull request.
- Component READMEs describe scope and implementation status without
  duplicating the specification.
- **Size the documentation to the change.** Update only the pages whose
  content the change actually alters. A one-line change does not touch a
  dozen pages.

#### Author a scenario

- **Read first**: the specification index and its authority rules; the
  area's page and its supporting page; every decision record that bears on the
  behavior; the traceability matrix, for what is already claimed. A need that
  is genuinely ambiguous goes through
  [`clarify-requirements`](../clarify-requirements/SKILL.md).
- **Write** the scenario in the area's existing `.feature` file: declarative
  `Given`/`When`/`Then` that names the trigger and asserts something
  observable. No UI mechanics outside a browser-tagged scenario, no class
  names, and no endpoint the interfaces page lacks.
- **A claim ID per new scenario**: the area's next unused number, never reused
  or renumbered.
- **Tags**: mark the scenario not built until it is, with the project's tag
  naming the open issue that will build it; tag browser-observable behavior
  with the browser tag.
- **An out-of-scope line** in the supporting page wherever someone could
  over-deliver; supporting detail that does not fit Gherkin (a table, a
  validation order, a diagram) goes there too.
- **Regenerate** the generated specification files before finishing, so a
  duplicate, malformed, or missing ID fails there, not in review.

### Exemptions from scenario coverage

- A behavior-changing pull request that changes no scenario fails the
  project's coverage check. The scenario must belong to an area the changed
  code serves, and must change in what it says: a whitespace, comment, or
  unrelated-area edit covers nothing.
- An exemption is only for a change that alters no behavior, and cites the
  claims the change leaves standing — claims of the areas the changed code
  serves.
- Pick the exemption category from the project's closed list, where the pull
  request template shows it. Never invent one.
- Run the check locally, not only in CI. When the tool reads its inputs from
  the environment, a bare run checks nothing and always passes.
- A bot that opens pull requests (a dependency updater) writes its own
  exemption from its configuration. If the check fails on one, fix the
  citation in that configuration; never hand-edit the pull request body.

### Lessons

- A bug fix that reveals a specification gap writes a lesson in the same pull
  request: symptom, root cause, spec delta, and the claim that now proves it.
  A fix that reveals nothing writes none.
- **Every lesson declares its kind** — product, process, or incident — and owes
  what that kind owes. A tool checks it.
- **Product lesson**: its remedy is a claim and a scenario; the spec delta
  names the claim. No skill change: restating product behavior in a skill
  creates a second place to drift from the specification.
- **Process lesson** (tooling, CI, hooks, conventions, delivery, how agents
  work): also update the skill or convention that would have prevented it, in
  the same pull request, and name it in the lesson's `## Skill` section. The
  skill holds the general rule; the lesson keeps the incident. Agents read
  skills, not the lessons index.
  - Update the generic skill when the rule transfers to any project, and the
    project's companion skill when the rule names the project's tools or
    paths.
  - Name the skill it changed once; no footer naming the generic skill too.
- **Incident** (an operational postmortem: something failed in running the
  system): symptom and root cause are what it owes. It may also name a skill
  it changed; never invent a rule just to give it one.
- A lesson keeps the project's sections and no others; extra detail is a
  subsection of one of them.

### ADRs

- One ADR per real architecture decision, in the same pull request —
  mandatory. A real decision is a new rule about the system, a reversed one, a
  privacy or data boundary, or an architecture choice (technology, rejected
  alternative, durable trade-off). UI polish, a bug fix, and a routine detail
  with no rejected alternative need none.
- **Not an ADR**: a new process, tooling, or agent-workflow rule is a
  convention, in the project's conventions directory, edited in place as it
  changes; interface detail (wording, layout, a field's behavior) is a
  scenario.
- **Write it from the project's template**: one status line under the title,
  then context, decision drivers (optional), considered options, decision,
  consequences. Considered options is required; a decision with no
  alternative worth naming says so there.
- **An accepted ADR is immutable.** Only its status changes, and a link's
  target when the file it points to moves or is deleted (point it at a
  permalink).
  - A change to the decision is a new ADR. The old one's status becomes
    `superseded`, its status line linking the new one.
  - A new ADR that changes part of an older one still supersedes the whole
    record, and lists what of it still holds — by link or claim ID — never
    restating it, so each rule keeps one source.
  - Never append an amendment, rewrite the body, or delete a record. A typo in
    an accepted ADR stays.
- **Statuses**: `proposed` (may change freely), `accepted`, `rejected`,
  `deprecated`, `superseded`. An accepted record moves only to `superseded` or
  `deprecated`, whose status line links the record that replaced or retired
  it; the other three are terminal. There is no partial supersession.
- An ADR's declared status agrees with its own status line, and a successor it
  names exists. Tools check both, and a CI check fails a pull request whose
  diff to an accepted ADR touches anything but its status.
- Number it after rebasing (see "Commit, rebase, claim identifiers"). Keep the
  filename and the `# ADR-NNNN` heading in step.
- Keep rationale and requirements apart: never restate a scenario's acceptance
  criteria in an ADR, and never justify a technology or pattern choice in a
  `.feature` file or its README.
- An ADR that changes a technology choice or how the system is broken up (new
  or replaced framework, language, runtime, hosting, topology, service split or
  merge) updates the root `README.md` in the same pull request — the fact and
  the ADR link, not the rationale. Skip routine or reversed-without-effect
  decisions.

### Markdown

- Every tracked markdown file declares frontmatter that says what it is; the
  project skill names the keys and the checking tool.
- Never include real user content or personal information.

### Agent instructions

- The agent instructions, skills, and role agents follow the `ai-author` role.
- Never hand-edit generated skill or agent copies. When a project-owned skill
  or agent changes, update its install manifest and lock file, and re-run the
  install.

## Keep the issue true while you work

The issue is the first hop of the specification chain: **correct the artifact,
not the chat.** A decision made after pickup — an answered question, an owner's
call, a scope change, something found already done — is not recorded until it
is in the issue. The next agent, the reviewer, and the squash commit read the
issue, not this conversation.

- **Edit the issue as soon as a decision lands, before building on it.** Keep
  the original need readable, and add or update:
  - **Decisions** — each decision, who made it, the date, one line each, with
    the rejected option where there was one;
  - **Acceptance criteria** — rewritten to match what will now be built;
  - **Out of scope** — what the discussion chose not to build.
  Strike or remove text the decisions made false.
- **Open a new issue** when added scope could ship on its own: independently
  deliverable, in a different area or layer, or roughly doubling the pull
  request. Give it its need, decisions, and acceptance criteria; wire it with a
  native relation (see "File a new issue"); link it from the original's
  Decisions. Scope that only makes the original need work stays.
- **Scope shrank?** Say so in the issue, and file what was dropped as its own
  issue if it is still wanted.
- **Re-read the issue before opening the pull request.** Its acceptance
  criteria, the scenarios, and the PR body describe the same change; if not,
  fix the issue or specification first.

## Verify and publish

The step numbers are stable; the project skill adds its commands under the
same numbers.

1. **Test, then pass the local CI gate.** First run, natively, the tests for
   the code you changed: the focused subset, not the whole suite. Then run the
   project's local CI runner with the draft pull request body. No pull request
   is opened until both pass.
   - The runner's default is the fast checks: the body checks and the cheap
     jobs. The slow jobs (the full test suite, coverage, the browser suite)
     run on GitHub, and the pull request's required checks, the coverage
     ratchet included, are the full gate. The runner has a flag for the full
     run; use it only when the full result is worth the wait.
   - It runs the pull request's own workflow files, not a copy of their
     commands: a re-implemented check drifts from the one CI runs.
   - A green test run is not a passing gate; the coverage ratchet and the
     body checks are separate checks.
   - On a coverage failure, test each uncovered branch the change added;
     delete a branch that can never run.
   - Local green is necessary, not sufficient: required checks still decide
     (step 9).
2. **Inspect** `git diff --check`, links, generated artifacts, and
   `git status`.
3. **Commit the last unit** — concise imperative message, no co-author
   trailer — rebase onto fresh `origin/main`, and push. Never open a pull
   request from a branch behind `origin/main`.
4. **Open the pull request** with a squash-ready title, then relabel the
   session `#<number> · PR #<pr> <short-description>`. Once the worktree is
   gone this label is the only record of which pull request the session owns.
   - **Enable auto-merge** on the pull request, unless it is a draft, someone
     asked to hold it, or the project reserves that step for a human — check
     `AGENTS.md` and this skill's companion.
   - **Never merge directly, bypass protections, or enqueue explicitly** — no
     plain or `--admin` merge, and no `enqueuePullRequest` or
     `mergePullRequest` mutation. Someone with the authority to merge does
     that by hand.
   - Keep working until the pull request's own required checks are green.
   - **Merge queue, once auto-merge is on**: the pull request enters the queue
     when its required checks pass. The queue tests it on top of the base
     branch and the pull requests ahead of it, then merges it; a branch that
     is only `BEHIND` needs no rebase.
   - **No merge queue**: auto-merge, once on, does not replace step 9. A
     branch that falls `BEHIND` still needs a rebase and push before it can
     merge.
5. **PR body**: `Closes #<number>` on its own line, and the scenarios it
   satisfies. Built something the specification does not describe? Either fix
   the specification or the change exceeded its scope.
6. **Screenshots** for any user-visible web change:
   - captured from the real running app by a browser tool, not a mockup;
   - an after shot alone satisfies a change, new page or changed;
   - a before shot is optional. Take one, from a build of `origin/main` before
     the code changes, only where it helps a reviewer see what moved;
   - state the page cannot capture (a native popup, an OS picker, a hover, a
     toast) is captured at OS level against a headed browser window. "It can't
     be captured" is not grounds to skip a shot;
   - taken after entry animations settle;
   - light and dark when the issue asks for both;
   - in the project's primary language;
   - committed in the repository, named `after-*` (and `before-*` if taken), and referenced
     from the body or a comment, not only pasted inline;
   - referenced by a `raw.githubusercontent.com` URL pinned to the adding
     commit. A relative path or `github.com/…/blob/…` URL renders broken;
   - before reporting, check each URL answers `image/png`:
     `curl -sI <url> | grep -i content-type`;
   - a web change with nothing visible says why in the body instead, in the
     project's exemption form.
7. **Prove it starts.** After pushing, start the app from the worktree and wait
   until it answers.
8. **Tear down at once**: stop what step 7 started, then `git worktree remove`.
   Containers belong to the checkout that started them; removing the worktree
   first leaves them holding the ports. Never leave a worktree behind — open,
   failing, or merged. Watching checks, reading logs, and commenting work from
   the primary checkout via `gh`.
9. **Watch required checks** from the primary checkout.
   - A check fails: recreate the worktree on the same branch (no `-b`):
     `git fetch origin issue-<number>/<short-description> && git worktree add .claude/worktrees/issue-<number>/<short-description> issue-<number>/<short-description>`.
     Fix, commit, rebase, push each fix, and repeat steps 7 and 8.
   - Green, without a merge queue: fetch and confirm
     `gh pr view <pr> --json mergeStateStatus` is not `BEHIND` — `main` moves
     while checks run. Behind? Rebase, push, watch again.
   - Green, with a merge queue: confirm the pull request is queued or merged.
     Rebase only for a real conflict (`DIRTY`), never because it is `BEHIND`.
   - **Removed from the queue?** The pull request's timeline says why.
     - A required check failed on the merge group: the pull request collides
       with something ahead of it or already merged (a duplicate number, a
       stale generated file, a coverage drop). Rebase onto fresh `main`,
       reproduce the failure, fix it, and push.
     - Timed out: re-queue it once; a second timeout is a hung check to fix.
     - If auto-merge was on and no longer is, say so when reporting — do not
       re-enable it yourself where a project reserves that step for a human.
   - Finish only when checks are green on a current (or queued) branch and no
     worktree remains, then relabel the session `✓ #<number> · PR #<pr> ready`
     (or `green` once merged, matching the project's convention).

## Path filters

- A CI job's path filter lists every input that job reads, not only the
  directory its code lives in. A missing input skips the job, and GitHub counts
  a skipped job as passing.
- A change to an input a skipped job would have read runs that job's suite
  locally before the pull request.

## Workflows that push

- **Onto a pull request's branch**: GitHub filters `paths` per push, so one
  bot's push often starts no run of another bot. A workflow pushing onto a pull
  request's branch replays its commit on top when the newer push touched none
  of its trigger files, never a bare `git push` that loses the race.
- **With a token on the remote URL**: check out with
  `persist-credentials: false`. The persisted `GITHUB_TOKEN` header outranks
  the URL, so the push authenticates as `github-actions[bot]` and its CI waits
  for maintainer approval.

## Required checks

- A new CI job that can fail the main branch joins the main ruleset's required
  status checks in the pull request that adds it, and its workflow triggers on
  `merge_group`. A check nobody requires holds nothing back.

## Workflow steps

- A `run:` step is one command. Logic goes in a script with its own test, and
  a plain sequence becomes separate steps.

## Concurrency and quotas

- **Serialise only the job that needs it.** A workflow-level concurrency group
  is held by every job in the run, including one waiting on an environment's
  reviewers. The platform keeps one pending run per group and cancels the one
  before it, so a run left waiting cancels every later one. That includes the
  checks those runs would have reported. Put the group on the job that must
  not overlap, such as a deploy or an apply.
- **A job that calls an API authenticates.** An anonymous quota is shared with
  whoever else is on the runner's address. A required check that spends it
  fails at random. Pass the job's own read-only token, under the variable the
  tool reads.
