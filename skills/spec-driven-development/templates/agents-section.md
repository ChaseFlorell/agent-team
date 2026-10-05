## Design authority

- [`{{root}}/features/README.md`]({{root}}/features/README.md) is the canonical
  target design; [`{{root}}/README.md`]({{root}}/README.md) is the generated
  index of every area, constraint page, decision, convention, and lesson.
- Source and tests show current state; issues are history.
- A requested change that conflicts with the specification: call out the
  conflict and update the specification first.
- A feature file and an accepted decision record never contradict each other;
  a contradiction is fixed at once by correcting whichever is wrong.

## Specification-driven development

Every hop is a tracked file:

```
need (issue)
  → scenario            {{root}}/features/<area>/<area>.feature
  → supporting detail   {{root}}/features/<area>/README.md, {{root}}/*.md
  → step definitions    <the project's step-definition directories>
  → code                <the project's source directories>
```

1. Specify before implementing, in the same pull request as the code.
2. Correct the specification, not the chat.
3. The specification delta is the change: the pull request names what it
   changed upstream and cites the claims it satisfies.
4. Say what not to build, in the area's README.
5. Use the glossary's words.
6. Steps describe behaviour, not implementation.
7. One behaviour per scenario.
8. Every diagram is a fenced `mermaid` block.

Procedure, templates, and the generator: the `spec-driven-development`
skill. Read the lessons under [`{{root}}/lessons/`]({{root}}/lessons/README.md)
on every design pass.
