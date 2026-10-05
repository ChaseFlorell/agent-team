# agent-team

A generic, full-stack team of Claude Code role agents and the skills they
preload. Every file here names nothing specific to one project, so the team
works in any repository; a project's own rules live in that project's
companion skills, which name the generic skill they extend and win where they
differ.

## The team

| Agent | Name | Role |
|---|---|---|
| `spec-author` | Jennifer | business analyst — scenarios and what is out of scope |
| `test-writer` | Kevin | QA engineer — a claim into a failing step definition |
| `backend` | Brad | back-end engineer — server side, scripts, CI |
| `ux` | Tiffany | UX designer and front-end engineer — web UI |
| `infrastructure` | Dave | cloud and DevOps engineer |
| `database-administrator` | Jane | PostgreSQL schema, EF Core mapping, migrations |
| `spec-reviewer` | Jessica | code reviewer — a diff against its claims and decisions |
| `critic` | Karen | design reviewer — a plan before it is built |
| `adversary` | Kyle | security engineer — attacks a change before it merges |
| `auditor` | Ashley | compliance auditor — the whole repository at rest |
| `ai-author` | Emily | maintains agent instructions |

Each agent's frontmatter declares its model, effort, tools, and the skills it
preloads, all under `skills/`.

## Install

Everywhere, for you:

```sh
git clone https://github.com/ChaseFlorell/agent-team.git
cd agent-team
skillfile install   # copies agents to ~/.claude/agents, skills to ~/.claude/skills
```

Re-run `skillfile install` after a `git pull`. A project's `.claude/agents`
shadows a user-level agent of the same name.

For every contributor of one project, pin the files from its own `Skillfile`
(the recommended project setup):

```
github  agent  ChaseFlorell/agent-team  agents/critic.md
github  skill  ChaseFlorell/agent-team  skills/review-work
```

`skillfile add github agent ChaseFlorell/agent-team agents/critic.md` writes
the same line. A name goes before the repository
(`github  skill  review-work  ChaseFlorell/agent-team  skills/review-work`) or
after `--name`.

**Precedence.** Claude Code resolves a user skill (`~/.claude/skills`) over a
project skill of the same name, but a project agent over a user agent. A user
who also installs globally should keep that install at the project's pinned
version, or install only one way.

## Rules

- Generic only: no product, domain, repository path, or decision, lesson,
  convention, or claim number. `node tools/check-generic-instructions.ts`
  enforces it, locally and in CI.
- Frontmatter has the shape its loader expects: a skill carries exactly `name`
  and `description`; an agent carries `name`, `description`, `model`, `effort`,
  and only Claude Code's other agent keys, and every skill it preloads exists.
  `node tools/check-frontmatter.ts` enforces it; `node --test tests/` runs the
  checks' own tests.
- An agent file is a persona and a role; how it works lives in the skills it
  preloads.
