---
name: watch-builds
description: Watch pull requests and builds on GitHub Actions and the local machine — run and check states, the watch loop, reading logs, classifying a failure as a code fault or a CI-server fault, duration baselines and outliers, CPU contention, routing, and the limits on re-running and cancelling. Use when watching a pull request's checks, triaging a red or hung run, or finding why a suite is slow.
---

# Watch builds

**Project rules.** A project may extend this skill with a companion skill that
names it; its agent instructions (`AGENTS.md`) list it. Read both. The
companion holds the project's paths, commands, and boundaries, and wins where
they differ.

## States

A check or run is one of these.

| State | Meaning for a pull request |
|---|---|
| `queued` | Waiting for a runner. Long wait: flag it. |
| `in_progress` | Running. Watch it. |
| `success` | Passing. |
| `failure` | Failed. Classify it. |
| `cancelled` | Stopped. Find the cause: superseded by a newer push, a concurrency group, or a manual cancel. A superseded run needs nothing. A run you cancelled as hung: classify it like the `timed_out` row and route it. |
| `timed_out` | Hit the time limit. See the decision table. |
| `action_required` | Waiting for a human approval. Route to the lead. |
| `skipped` | Did not run. A skipped required check counts as passing; see `deliver-change` "Path filters". |
| `neutral` | Finished without a verdict. Passing. |
| `stale` | Superseded or never started. Re-check the latest run. |
| `startup_failure` | The workflow never started. A CI-server fault. |

## Watch loop

Poll; never use `gh pr checks --watch`, which blocks past the Bash timeout.

- Pull request: `gh pr view <pr> --json statusCheckRollup,mergeStateStatus,autoMergeRequest`.
- Runs on the branch: `gh run list --branch <branch> --json databaseId,name,status,conclusion,event,headSha`.
- One run's jobs and steps: `gh run view <id> --json jobs`.
- Poll every 30 seconds for the first five minutes, then every 2 minutes.
- Stop at merged or closed, not at green.

## Read the logs

- `gh run view <id> --log-failed` for the failing job and step. Logs are not
  served until a job completes.
- Annotations name the file and line: take `<job-id>` from `.jobs[].databaseId`
  of `gh run view <id> --json jobs`, then
  `gh api repos/{owner}/{repo}/check-runs/<job-id>/annotations`.
- Report the first real error, not the last line.
- Read the test runner's summary line (passed, failed, skipped counts).

## Classify

Take the first matching row.

| Evidence | Class | Action |
|---|---|---|
| Assertion or test failure; compile or lint error; coverage drop; specification or body check | Code fault | Author, now |
| A test that has both failed and passed at the same SHA in run history (flaky) | Code fault | Author, now |
| Exit code 137 (out of memory), except the next row | Code fault | Author, now |
| Exit code 137 on a self-hosted runner showing capacity signs (full disk, memory exhausted by other jobs) | CI-server fault | Infrastructure |
| Exit code 143: first check the run's `conclusion` and timeline for `timed_out` or `cancelled`; only if neither, it is a lost runner | As the timeline shows | As that class |
| Lost runner or shutdown signal; `startup_failure`; network or DNS failure; registry or mirror 5xx or 429; platform cache or service failure | CI-server fault | Re-run if allowed, then route |
| `timed_out` or a cancelled hung run: a step over 2x its baseline with contention signs | CI-server fault | Route |
| `timed_out` or a cancelled hung run: any other case, including no baseline | Code fault | Author, now |
| Anything unclear | Code fault, and say it is unclear | Author. Never re-run to find out |

## Durations and outliers

- Baseline: the median job and step durations over the last 10 successful
  default-branch runs of the same workflow (`gh run list --workflow <name> --branch <default> --status success --limit 10`, then `gh run view <id> --json jobs`).
  Fewer than 10 successful runs, or a step missing from them: no baseline.
- Over 1.5x the baseline: flag it. Over 2x: slow, an outlier.
- Also flag a long queue wait, a new or newly slow step, and a change in test
  count.
- Hung, from `gh run view <id> --json jobs`: a step has `startedAt` and no
  `completedAt` for more than 3x that step's baseline median (15-minute
  floor), and the job's count of completed steps is the same across two
  polls. No baseline for the step: never cancel; route to the author as a
  suspected hang.

## CPU contention

- CI: every step slowed by a similar ratio, or slow only while other runs
  share the runner.
- Local, where parallel agents run suites in worktrees:
  - Load against cores: `uptime`, and `sysctl -n hw.ncpu` or `nproc`.
  - Processes: `ps -Ao pid,pcpu,etime,comm`. Report the basename of `comm`
    only.
  - Owning worktree: `lsof -a -d cwd -p <pid> -Fn`. Report the path relative
    to the repository, never an absolute path.
  - Containers: `docker ps --format '{{.ID}} {{.Names}} {{.Image}} {{.Status}}'`
    (never bare `docker ps`), and `docker stats --no-stream`.
  - Worktrees: `git worktree list`; flag a test process whose worktree is
    gone.
- Report the pid, process name, CPU, elapsed time, and owning worktree. Kill
  nothing.

## Route

The one home for the report line: **check, job, and step; classification;
evidence as a location or shape; next action.** Never quote credentials,
personal data, or user content from a log.

- First failure: `SendMessage` to the author at once, without waiting on other
  checks. If the author has stopped, send it to the lead.
- A CI-server fault that repeats after its one re-run, or that cannot be
  re-run under "Re-run and cancel":
  - in a workflow: to backend;
  - on a self-hosted runner: to infrastructure;
  - outside the team's control (platform incident, third-party registry,
    hosted runner): to the lead or the owner, to wait out.
- A `merge_group` run that failed, was removed from the merge queue, or
  auto-merge turned off: tell the author the reason from the timeline.
- `mergeStateStatus` of `BEHIND` or `DIRTY`: tell the author.
- For the last two, the author follows `deliver-change` step 9.
- Report every re-run and cancel to the author with its reason.

## Re-run and cancel

Touch a run only when every check below passes. If one cannot be confirmed,
touch nothing and route to the lead.

1. The run's `event` is `pull_request`: `gh run view <id> --json event`.
   Never re-run or cancel a `merge_group` run; the queue owns it.
2. Workflow file: get `path` from `gh run view <id> --json workflowName,path`,
   then `gh api repos/{owner}/{repo}/contents/<path> --jq .content | base64 -d`.
   It must contain no `environment:` key and must not be a deploy, release,
   promote, or infrastructure plan workflow. A companion skill's explicit
   allow-list of check workflow files wins.
3. Re-run only: `gh run view <id> --json attempt` gives 1. Then
   `gh run rerun <id> --failed`. Never re-run attempt 2 or later.
4. Cancel only a hung run (see "Durations and outliers") or a superseded run:
   `gh run cancel <id>`. Superseded means the run's `headSha` differs from
   `gh pr view <pr> --json headRefOid`.
