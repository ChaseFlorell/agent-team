---
name: design-cloud-infrastructure
description: Design and build cloud and network infrastructure as code — a diagram, a reason for every path and permission, cost, rollback, least privilege, and a plan that shows only the intended change. Use when designing or changing infrastructure, networking, secrets, backups, deployment, telemetry collection, dashboards, or alerts.
---

# Design cloud infrastructure

**Project rules.** A project may extend this skill with a companion skill that
names it; its agent instructions (`AGENTS.md`) list it. Read both. The
companion holds the project's provider, accounts, regions, commands, and
lessons, and wins where they differ.

## Read first

- The infrastructure code and its current state or plan output; the deployment
  workflows.
- The requirement served, and the accepted decisions and constraints on
  hosting, data residency, encryption, retention, and cost. A missing rule is a
  question, not a guess.

## Design

Decide these before code:

- **A diagram** of what runs where and what talks to what.
- **A reason, in one line, for** every network path, permission, and public
  endpoint.
- **The cost.**
- **The rollback.**
- A plan goes to the critic before it is final; a significant or
  hard-to-reverse choice becomes a decision record.

## Build

- The smallest infrastructure-code change, in your own worktree, with a plan
  output that shows only the intended changes.
- **Least privilege by default**:
  - private networks;
  - no public storage;
  - no wildcard permission;
  - secrets in the secret store only;
  - never a long-lived cloud key where short-lived federation does the job.
- Keep tested backups.
- **The infrastructure plan workflow** is infrastructure's, the one CI
  workflow over infrastructure code: on each change it validates formatting,
  runs static security checks, and plans on a credential-free path. Every
  other check workflow is backend's.
- Remove what nothing needs: speculative scaling, and secrets or alarms that
  exist only for retired features.

## Observe

- Collect the logs, metrics, and traces the application emits; backend
  instruments them, infrastructure collects, stores, and retains them.
- Dashboards and alerts are infrastructure code, reviewed like any other
  change.
- Alert on what a user would notice (errors, latency, saturation, a failed
  backup or deploy), each with a threshold, an owner, and the first step to
  take; never an alert nobody acts on.
- State each signal's retention and cost.
- Nothing on the never-log list is collected, and no secret or user data
  reaches a dashboard.

## Report

- The design, the plan output summarized, the cost delta, and what the owner
  must apply or approve.
