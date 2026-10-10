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
| `ux` | Tiffany | UX designer — interaction flow, accessibility semantics, and localized copy on every platform; builds nothing |
| `client` | Megan | client engineer — web, desktop, and mobile clients, built from the UX hand-off and approved boards |
| `designer` | Brittany | UI designer — visual layout, boards, states, and design-system values before build |
| `infrastructure` | Dave | cloud and DevOps engineer |
| `database-administrator` | Jane | PostgreSQL schema, EF Core mapping, migrations |
| `spec-reviewer` | Jessica | code reviewer — a diff against its claims and decisions |
| `critic` | Karen | design reviewer — a plan before it is built |
| `adversary` | Kyle | security engineer — attacks a change before it merges |
| `auditor` | Ashley | compliance auditor — the whole repository at rest |
| `babysitter` | Kristy | build babysitter — watches pull requests and builds, classifies each failure, routes it |
| `ai-author` | Emily | maintains agent instructions |

Each agent's frontmatter declares its model, effort, tools, and the skills it
preloads, all under `skills/`. An agent with no `tools` key inherits every tool
the session offers, connectors included; the designer relies on that to reach
a design tool, so a `tools` list added to it must keep those.

The `babysitter` guards its commands with a frontmatter hook, so spawn it as a
plain subagent, never as an agent-team teammate; teammates get no hooks.

## Team skills

| Skill | Holds | Use when |
|---|---|---|
| `agent-persona` | how a named role agent speaks: voice in session, plain findings | acting as a named role agent |
| `build-avalonia-ui` | Avalonia layer of `build-native-ui`: resources, control themes, pseudo-class states, automation properties | implementing or changing an Avalonia screen, component, or theme |
| `build-native-ui` | stack-agnostic native build to the hand-off: tokens, states, platform accessibility APIs, component and UI tests | implementing or changing a native screen, view model, or component on any stack |
| `build-web-ui` | the client's web build, exactly to the hand-off: accessible, localized, responsive markup, component tests, screenshots | implementing or changing a web screen or component |
| `clarify-requirements` | resolving a genuinely material requirement ambiguity | two readings would build different systems |
| `coding-conventions` | orient first, stop on a gap, keep the design direct, put a rule where it runs | any code, test, doc, or diagram change |
| `deliver-change` | issue, worktree, pull request, docs, and CI workflow | creating or editing issues, worktrees, PRs, or checks |
| `design-avalonia-ui` | Avalonia layer of `design-native-ui`: tokens, Light and Dark variants, control states, density, drawn versus templated, boards, builder hand-off | designing or changing an Avalonia screen, component, or theme |
| `design-cloud-infrastructure` | infrastructure as code: a diagram, least privilege, cost, rollback, the plan workflow, telemetry, dashboards, and alerts | designing or changing infrastructure, secrets, backups, deployment, telemetry, dashboards, or alerts |
| `design-ef-core-model` | a PostgreSQL schema as an EF Core model: relationships, types, indexes, queries | adding or changing an entity, DbContext, relationship, or query shape |
| `design-native-ui` | stack-agnostic native design: platform conventions, input and density, every state in every theme, platform accessibility, window sizes and safe areas, boards, builder hand-off | designing or changing a native screen, component, or theme on any stack |
| `design-ux-flow` | platform-neutral user experience: interaction flow, accessibility semantics, localized copy, and the hand-off | designing or changing how a screen, component, or feature flows, is announced, or reads |
| `design-web-ui` | the designer's web UI: boards for every state and width, builder hand-off | designing or changing the look of a web screen or component |
| `manage-ef-core-migrations` | EF Core migrations: generated, never edited, seeded, baselined, squashed | adding a table, column, index, constraint, or seed |
| `postgres-dba` | PostgreSQL administration: design, audit, evolve, seed, operate | schema design, audit, column types, slow queries, locks |
| `review-work` | what every reviewing role shares: read-only, one finding per line, severities | reviewing a plan, a diff, or a working tree |
| `spec-driven-development` | the artifact chain, the specification directory, feature areas, constraint pages, ADRs, conventions, lessons, the glossary, the generated index, and the generator that creates and checks them all | starting a project on the method, or writing a scenario, ADR, convention, or lesson |
| `test-from-scenarios` | scenario tags, step definitions from the scenario, seeded data, pinned containers | test changes or behaviour that needs verification |
| `watch-builds` | watching pull requests and builds: states, logs, classifying a failure, baselines, contention, routing, re-run and cancel limits | watching a pull request's checks, triaging a red or hung run, or finding why a suite is slow |
| `write-agent-instructions` | the agent-file shape, style rules, and the editing procedure that loses no rule | adding or changing instructions, a skill, or a role agent, or auditing their shape and style |

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

`design-avalonia-ui` extends `design-native-ui`, and `build-avalonia-ui` extends
`build-native-ui`; a project that pins an Avalonia skill must pin both of its
pair:

```
github  skill  ChaseFlorell/agent-team  skills/design-avalonia-ui
github  skill  ChaseFlorell/agent-team  skills/design-native-ui
github  skill  ChaseFlorell/agent-team  skills/build-avalonia-ui
github  skill  ChaseFlorell/agent-team  skills/build-native-ui
```

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
