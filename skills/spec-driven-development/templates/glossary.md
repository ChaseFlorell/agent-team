---
title: Glossary
description: "The specification's vocabulary: one canonical word per concept, and the synonyms a scenario or area README may not use."
type: spec
area: glossary
---

# Glossary

The words the scenarios and area READMEs use, one per concept. A scenario
names a concept exactly as a row here does; the **Banned in scenarios** column
lists the synonyms it may not use, each in backticks: a phrase matched as
whole words ignoring case, or a `/pattern/flags` regular expression. An
optional **Exempt areas** column names the areas, by directory, where that
row's bans do not apply. `sdd.ts check` refuses a banned synonym in a
`.feature` file or an area README, outside `"double quotes"`, `` `code` ``,
and `<placeholders>`.

## People and roles

| Term | Definition | Banned in scenarios | Exempt areas |
|---|---|---|---|
| <visitor> | <Anyone using the system without signing in.> | | |

## Things

| Term | Definition | Banned in scenarios |
|---|---|---|
| <record> | <What the system stores for one …> | |

## Outcomes

The phrases a Then uses for a refusal, so a scenario never names a status
code or a transport term:

| Phrase | Meaning |
|---|---|
| is refused as invalid | the request was understood and its content rejected |
| is refused as unauthenticated | no, or no valid, identity was presented |
| is refused as forbidden | the identity presented may not do this |
| is not found | the thing named does not exist for this actor |
