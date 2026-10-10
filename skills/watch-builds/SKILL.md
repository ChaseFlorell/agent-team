---
name: watch-builds
description: Watch pull requests and builds on GitHub Actions and the local machine — run and check states, the watch loop, reading logs, classifying a failure as a code fault or a CI-server fault, duration baselines and outliers, CPU contention, routing, and the limits on re-running and cancelling. Use when watching a pull request's checks, triaging a red or hung run, or finding why a suite is slow.
---

# Watch builds

**Project rules.** A project may extend this skill with a companion skill that
names it; its agent instructions (`AGENTS.md`) list it. Read both. The
companion holds the project's paths, commands, and boundaries, and wins where
they differ.

Read-only except one re-run and a cancel, under "Re-run and cancel". Never
quote credentials, personal data, or user content from a log.

## States

A check or run is one of these.

| State | Meaning for a pull request |
|---|---|
| `queued` | Waiting for a runner. Long wait: flag it. |
| `in_progress` | Running. Watch it. |
| `success` | Passing. |
| `failure` | Failed. Classify it. |
| `cancelled` | Stopped. Find the cause: superseded by a newer push, a concurrency group, or a manual cancel. A superseded run needs nothing. |
| `timed_out` | Hit the time limit. See the decision table. |
| `action_required` | Waiting for a human approval. Route to the lead. |
| `skipped` | Did not run. A skipped required check counts as passing; see `deliver-change` "Path filters". |
| `neutral` | Finished without a verdict. Passing. |
| `stale` | Superseded or never started. Re-check the latest run. |
| `startup_failure` | The workflow never started. A CI-server fault. |

## Watch loop

- Watch a pull request: `gh pr checks <pr> --watch`.
- Or poll: `gh pr view <pr> --json statusCheckRollup,mergeStateStatus,autoMergeRequest`.
- List runs on the branch: `gh run list --branch <branch> --json databaseId,name,status,conclusion,event,headSha`.
- Inspect one run's jobs: `gh run view <id> --json jobs`.
- Back off while runs are long: poll every 30 seconds for the first five
  minutes, then every 2 minutes.
- Stop at merged or closed, not at green.

## Read the logs

- `gh run view <id> --log-failed` for the failing job and step. Check-run
  annotations (`gh api repos/{owner}/{repo}/check-runs/<id>/annotations`) name
  the file and line.
- Report the first real error, not the last line.
- Exit code 137 means killed for memory; 143 means terminated.
- Read the test reporter's summary: counts of passed, failed, and skipped.

## Classify

Take the first matching row.

| Evidence | Class | Action |
|---|---|---|
| Assertion or test failure; compile or lint error; coverage drop; specification or body check | Code fault | Author, now |
| A test that has both failed and passed at the same SHA in run history (flaky) | Code fault | Author, now |
| Lost runner or shutdown signal; `startup_failure`; network or DNS failure; registry or mirror 5xx or 429; platform cache or service failure | CI-server fault | Re-run once, then route |
| `timed_out`, first time | Compare the step to its baseline: slow with no contention is a code fault; contention signs are a CI-server fault | As that class |
| Anything unclear | Code fault, and say it is unclear | Author. Never re-run to find out |

## Durations and outliers

- Baseline: the median job and step durations over the last 10 successful
  default-branch runs of the same workflow (`gh run list --workflow <name> --branch <default> --status success --limit 10`, then `gh run view <id> --json jobs`).
- Over 1.5x the baseline: flag it. Over 2x: it is an outlier.
- Also flag a long queue wait, a new or newly slow step, and a change in test
  count.
- Hung: no new log output for 3x the step's baseline median, with a
  15-minute floor.

## CPU contention

- CI: every step slowed by a similar ratio, or slow only while other runs
  share the runner.
- Local, where parallel agents run suites in worktrees:
  - Load against cores: `uptime`, and `sysctl -n hw.ncpu` or `nproc`.
  - Processes: `ps -Ao pid,pcpu,etime,comm`. Never list the full argument
    list.
  - Containers: `docker ps` and `docker stats --no-stream`.
  - Worktrees: `git worktree list`; flag a test process whose worktree is
    gone.
- Report the pid, process name, CPU, elapsed time, and owning worktree. Kill
  nothing.

## Route

The one home for the report line: **check, job, and step; classification;
evidence as a location or shape; next action.** Never quote credentials,
personal data, or user content.

- First failure: `SendMessage` to the author at once, without waiting on other
  checks. If the author has stopped, send it to the lead.
- A CI-server fault that repeats after its one re-run:
  - in a workflow: to backend;
  - on a self-hosted runner: to infrastructure;
  - outside the team's control (platform incident, third-party registry,
    hosted runner): to the lead or the owner, to wait out.
- Removed from the merge queue, or auto-merge turned off: tell the author the
  reason from the timeline. The author follows `deliver-change` step 9.

## Re-run and cancel

- Re-run: `gh run rerun <id> --failed`, once per fault per SHA.
- Cancel: `gh run cancel <id>`, only a hung or superseded run.
- Both only when the run's `event` is `pull_request` or `merge_group`
  (`gh run view <id> --json event`).
- Never on a run that targets an environment, or a deploy, release, promote,
  or infrastructure plan workflow.
- Report every re-run and cancel with its reason.
