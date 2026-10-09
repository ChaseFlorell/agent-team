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
| `backend` | Brad | back-end engineer — server side, scripts, build, test, and check CI |
| `ux` | Tiffany | front-end engineer — web UX flow and the web build |
| `native-client` | Megan | native client engineer — desktop and mobile clients, built from approved boards |
| `designer` | Brittany | UI designer — visual layout, boards, states, and design-system values before build |
| `infrastructure` | Dave | cloud and DevOps engineer |
| `database-administrator` | Jane | PostgreSQL schema, EF Core mapping, migrations |
| `spec-reviewer` | Jessica | code reviewer — a diff against its claims and decisions |
| `critic` | Karen | design reviewer — a plan before it is built |
| `adversary` | Kyle | security engineer — attacks a change before it merges |
| `auditor` | Ashley | compliance auditor — the whole repository at rest |
| `ai-author` | Emily | maintains agent instructions |

Each agent's frontmatter declares its model, effort, tools, and the skills it
preloads, all under `skills/`. An agent with no `tools` key inherits every tool
the session offers, connectors included; the designer relies on that to reach
a design tool, so a `tools` list added to it must keep those.

## Team skills

| Skill | Holds | Use when |
|---|---|---|
| `agent-persona` | how a named role agent speaks: voice in session, plain findings | acting as a named role agent |
| `clarify-requirements` | resolving a genuinely material requirement ambiguity | two readings would build different systems |
| `coding-conventions` | orient first, stop on a gap, keep the design direct, put a rule where it runs | any code, test, doc, or diagram change |
| `deliver-change` | issue, worktree, pull request, docs, and CI workflow | creating or editing issues, worktrees, PRs, or checks |
| `design-cloud-infrastructure` | infrastructure as code: a diagram, least privilege, cost, rollback | designing or changing infrastructure, secrets, backups, deployment |
| `design-avalonia-ui` | Avalonia design: theme-aware tokens, control themes, pseudo-class states, density, boards, builder hand-off | designing or changing an Avalonia screen, component, or theme |
| `design-ef-core-model` | a PostgreSQL schema as an EF Core model: relationships, types, indexes, queries | adding or changing an entity, DbContext, relationship, or query shape |
| `design-web-ui` | accessible, localized, responsive web UI with screenshots | designing or changing a screen, a component, or its copy |
| `manage-ef-core-migrations` | EF Core migrations: generated, never edited, seeded, baselined, squashed | adding a table, column, index, constraint, or seed |
| `postgres-dba` | PostgreSQL administration: design, audit, evolve, seed, operate | schema design, audit, column types, slow queries, locks |
| `review-work` | what every reviewing role shares: read-only, one finding per line, severities | reviewing a plan, a diff, or a working tree |
| `spec-driven-development` | the artifact chain, the specification directory, feature areas, constraint pages, ADRs, conventions, lessons, the glossary, the generated index, and the generator that creates and checks them all | starting a project on the method, or writing a scenario, ADR, convention, or lesson |
| `test-from-scenarios` | scenario tags, step definitions from the scenario, seeded data, pinned containers | test changes or behaviour that needs verification |
| `write-agent-instructions` | the agent-file shape, style rules, and the editing procedure that loses no rule | adding, changing, or auditing instructions, a skill, or a role agent |

`cucumber-best-practices`, the Gherkin style guide `spec-author` preloads,
is pinned from upstream in the `Skillfile` rather than kept here.

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
  enforces it, locally and in CI. The one carve-out: the skill that defines
  the specification scheme (`spec-driven-development`) may name the scheme's
  own directory, generated files, and ID forms.
- Frontmatter has the shape its loader expects: a skill carries exactly `name`
  and `description`; an agent carries `name`, `description`, `model`, `effort`,
  and only Claude Code's other agent keys, and every skill it preloads exists.
  `node tools/check-frontmatter.ts` enforces it; `node --test tests/*.test.ts` runs the
  checks' own tests.
- An agent file is a persona and a role; how it works lives in the skills it
  preloads.
