import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import {
	anchor,
	anchors,
	checkProblems,
	coverage,
	exemption,
	generate,
	globToRegExp,
	init,
	newAdr,
	newConvention,
	newFeature,
	newLesson,
	newPage,
	nextClaim,
	parseFeature,
	parseFrontmatter,
	run,
	slugify,
	type Context,
} from './sdd.ts'

const ROOT = '.spec'

const FEATURE = `Feature: Orders
Customers place an order from their basket and see its progress.

@REQ-ORD-001
Scenario: A customer places an order from a non-empty basket
  Given a customer has two items in their basket
  When the customer places the order
  Then the order is confirmed to the customer
  And the basket is empty

@REQ-ORD-002
@ignore @issue-42
Scenario: An order for an item that sold out is refused
  Given a customer has an item in their basket that has since sold out
  When the customer places the order
  Then the order is refused as invalid

@REQ-ORD-003
@ui
Scenario Outline: The order page shows each line with its price
  Given a customer placed an order with <count> items
  When the customer opens the order
  Then each item is shown with its quantity and price

Examples:
  | count |
  | 1     |
  | 2     |
`

const README = `---
title: Orders
description: Supporting detail for the order placement scenarios.
type: spec
area: orders
prefix: REQ-ORD
---

# Orders

Supporting detail for [\`orders.feature\`](orders.feature).

## Out of scope

What not to build here:

- Partial shipments (#9).
`

const page = (title: string, slug: string, bullets: string): string => `---
title: ${title}
description: What ${slug} constrains.
type: spec
area: ${slug}
---

# ${title}

## Rules

${bullets}
`

/** A context over a fresh temporary directory, empty or with the `init` layout. */
function context(): Context {
	return { cwd: mkdtempSync(join(tmpdir(), 'sdd-')), root: ROOT }
}

const path = (ctx: Context, rel: string): string => join(ctx.cwd, ROOT, rel)
const read = (ctx: Context, rel: string): string => readFileSync(path(ctx, rel), 'utf8')
function write(ctx: Context, rel: string, text: string): void {
	mkdirSync(dirname(path(ctx, rel)), { recursive: true })
	writeFileSync(path(ctx, rel), text)
}
const edit = (ctx: Context, rel: string, from: string | RegExp, to: string): void => write(ctx, rel, read(ctx, rel).replace(from, to))
const messages = (ctx: Context): string => checkProblems(ctx).map((problem) => `${problem.file}:${problem.line ?? ''}: ${problem.message}`).join('\n')

const GLOSSARY = `---
title: Glossary
description: The specification's vocabulary.
type: spec
area: glossary
---

# Glossary

| Term | Definition | Banned in scenarios |
|---|---|---|
| customer | Anyone who places an order. | \`guest\` |
`

/** A valid specification: the `init` layout, one area, one of each record, every placeholder filled in, generated. */
function fixture(): Context {
	const ctx = context()
	assert.equal(init(ctx, { project: 'Shop' }).code, 0)
	write(ctx, 'glossary.md', GLOSSARY)
	assert.equal(newFeature(ctx, 'orders', 'ORD', 'Orders').code, 0)
	assert.equal(newAdr(ctx, 'Orders are priced at placement', 'Chase').code, 0)
	assert.equal(newConvention(ctx, 'A scenario is written before its code').code, 0)
	assert.equal(newLesson(ctx, 'A sold-out item slipped through', '7', 'product').code, 0)
	write(ctx, 'features/orders/orders.feature', FEATURE)
	write(ctx, 'features/orders/README.md', README)
	write(ctx, 'system-overview.md', page('System overview', 'system-overview', '- **CON-SO-001** An order is confirmed only from a non-empty basket.\n  *Verified by: REQ-ORD-001.*'))
	write(ctx, 'testing-and-quality.md', page('Testing and quality', 'testing-and-quality', '- **CON-TQ-001** Tests protect user-visible contracts.\n  *Verified by: none — a rule about the suites.*'))
	const adr = 'decisions/ADR-0001-orders-are-priced-at-placement.md'
	edit(ctx, adr, /description: <[^\n]*/, 'description: Prices are fixed when the order is placed.')
	edit(ctx, adr, 'status: proposed', 'status: accepted')
	edit(ctx, adr, /keywords: <[^\n]*/, 'keywords: pricing')
	edit(ctx, adr, /\*\*Status:\*\* Proposed\.[\s\S]*?\n\n/, '**Status:** Accepted. Decided by Chase on 2026-10-05 in #3.\n\n')
	edit(ctx, 'conventions/CONV-001-a-scenario-is-written-before-its-code.md', /description: <[^\n]*/, 'description: A scenario precedes its code.')
	const lesson = 'lessons/0001-a-sold-out-item-slipped-through.md'
	edit(ctx, lesson, /description: <[^\n]*/, 'description: A sold-out item was ordered.')
	edit(ctx, lesson, /## Spec delta\n\n- <[^\n]*/, '## Spec delta\n\n- REQ-ORD-002 added.')
	edit(ctx, lesson, /## Scenario\n\n<[^\n]*(\n[^\n]*)?/, '## Scenario\n\nREQ-ORD-002.')
	edit(ctx, lesson, /## Skill\n\n<[\s\S]*/, '## Skill\n\nNone — the claim is the remedy.\n')
	assert.equal(generate(ctx).code, 0)
	return ctx
}

// --- helpers

test('GivenFrontmatterWithListAndQuotes_WhenParsed_ThenFlatValues', () => {
	const parsed = parseFrontmatter('---\ntitle: "A: title"\nkeeps:\n  - REQ-A\n  - REQ-B=12\n---\nbody\n')
	assert.equal(parsed.data.title, 'A: title')
	assert.equal(parsed.data.keeps, 'REQ-A REQ-B=12')
	assert.equal(parsed.end, 5)
	assert.match(parseFrontmatter('no block').error ?? '', /no YAML frontmatter/)
})

test('GivenFeatureText_WhenParsed_ThenTagsStepsAndExamplesAreRead', () => {
	const feature = parseFeature(FEATURE)
	assert.equal(feature.title, 'Orders')
	assert.equal(feature.scenarios.length, 3)
	assert.deepEqual(feature.scenarios[1].tags, ['@REQ-ORD-002', '@ignore', '@issue-42'])
	assert.deepEqual(
		feature.scenarios[0].steps.map((step) => step.keyword),
		['Given', 'When', 'Then', 'Then'],
	)
	assert.equal(feature.scenarios[2].keyword, 'Scenario Outline')
	assert.deepEqual(
		feature.scenarios[2].examples.map((row) => row.cells),
		[['1'], ['2']],
	)
})

test('GivenTitles_WhenSlugged_ThenKebabWithoutPossessives', () => {
	assert.equal(slugify("A customer's photos, and video!"), 'a-customers-photos-and-video')
	assert.equal(anchor('ADR-0001 — Orders `now`'), 'adr-0001--orders-now')
})

test('GivenGlobs_WhenMatched_ThenStarAndDoubleStarBehave', () => {
	assert.ok(globToRegExp('src/**').test('src/a/b.ts'))
	assert.ok(globToRegExp('src/*/Dockerfile').test('src/api/Dockerfile'))
	assert.ok(!globToRegExp('src/*/Dockerfile').test('src/api/deep/Dockerfile'))
	assert.ok(globToRegExp('**/routes/Orders*').test('web/src/routes/OrdersPage.tsx'))
	assert.ok(!globToRegExp('src/*.ts').test('src/a.tsx'))
})

test('GivenBodies_WhenExemptionRead_ThenCategoryReasonAndClaimsOrWhyNot', () => {
	assert.deepEqual(exemption('No .feature scenario needed: refactor — moved code\nClaims preserved: REQ-ORD-001, REQ-ORD-002').exemption, {
		category: 'refactor',
		reason: 'moved code',
		preserved: ['REQ-ORD-001', 'REQ-ORD-002'],
	})
	assert.match(exemption('No .feature scenario needed: copy — reworded').problem ?? '', /not an exemption category/)
	assert.match(exemption('No .feature scenario needed: refactor — moved code').problem ?? '', /Claims preserved/)
	assert.match(exemption('No .feature scenario needed: nothing').problem ?? '', /exemption line/)
	assert.deepEqual(exemption('plain body'), {})
})

// --- init and new

test('GivenEmptyDirectory_WhenInit_ThenEveryFileExistsAndASecondInitKeepsThem', () => {
	const ctx = context()
	const first = init(ctx, { project: 'Shop' })
	assert.equal(first.code, 0, first.errors.join('\n'))
	for (const rel of ['README.md', 'traceability.md', 'claims.json', 'area-paths.json', 'glossary.md', 'system-overview.md', 'testing-and-quality.md', 'features/README.md', 'decisions/README.md', 'conventions/README.md', 'lessons/README.md']) {
		assert.ok(existsSync(path(ctx, rel)), rel)
	}
	assert.match(read(ctx, 'features/README.md'), /^title: Shop specification$/m)
	assert.match(first.output.join('\n'), /## Specification-driven development/)
	write(ctx, 'glossary.md', 'edited')
	const second = init(ctx, { project: 'Shop' })
	assert.equal(second.code, 0)
	assert.equal(read(ctx, 'glossary.md'), 'edited')
	assert.match(second.output.join('\n'), /kept \.spec\/glossary\.md/)
	assert.match(init(context(), {}).errors.join('\n'), /--project/)
})

test('GivenInit_WhenNewFeature_ThenFilesAndAreaPathsEntryAndNextClaim', () => {
	const ctx = context()
	init(ctx, { project: 'Shop' })
	const result = newFeature(ctx, 'orders', 'ORD', 'Orders')
	assert.equal(result.code, 0, result.errors.join('\n'))
	assert.match(read(ctx, 'features/orders/orders.feature'), /^Feature: Orders$/m)
	assert.match(read(ctx, 'features/orders/README.md'), /^prefix: REQ-ORD$/m)
	assert.deepEqual(JSON.parse(read(ctx, 'area-paths.json')), { every: [], areas: { orders: [] } })
	assert.match(result.output.join('\n'), /wrote \.spec\/README\.md/)
	assert.match(read(ctx, 'README.md'), /\[Orders\]\(features\/orders\/orders\.feature\)/)
	assert.equal(generate(ctx, { check: true }).code, 0)
	assert.equal(nextClaim(ctx, 'orders').output[0], 'REQ-ORD-001')
	assert.match(newFeature(ctx, 'orders', 'ORD', 'Orders').errors[0], /already exists/)
	assert.match(newFeature(ctx, 'returns', 'ORD', 'Returns').errors[0], /already orders's/)
	assert.match(newFeature(ctx, 'Bad Name', 'RET', 'Returns').errors[0], /kebab-case/)
})

test('GivenInit_WhenNewRecords_ThenNumberedFilenamesAndFrontmatter', () => {
	const ctx = context()
	init(ctx, { project: 'Shop' })
	assert.equal(newAdr(ctx, "The customer's basket is server-side", 'Chase').code, 0)
	assert.equal(newAdr(ctx, 'Second', 'Chase').code, 0)
	assert.deepEqual(readdirSync(path(ctx, 'decisions')).sort(), ['ADR-0001-the-customers-basket-is-server-side.md', 'ADR-0002-second.md', 'README.md'])
	const adr = read(ctx, 'decisions/ADR-0001-the-customers-basket-is-server-side.md')
	assert.match(adr, /^type: adr$/m)
	assert.match(adr, /^decision-makers: Chase$/m)
	assert.match(adr, /^# ADR-0001 — The customer's basket is server-side$/m)
	assert.match(adr, /^date: \d{4}-\d{2}-\d{2}$/m)
	assert.equal(newConvention(ctx, 'Hooks are tracked').code, 0)
	assert.match(read(ctx, 'conventions/CONV-001-hooks-are-tracked.md'), /^# CONV-001 — Hooks are tracked$/m)
	assert.equal(newLesson(ctx, 'A guard only in CI', '12', 'process').code, 0)
	assert.match(read(ctx, 'README.md'), /\| \[0001\]\(lessons\/0001-a-guard-only-in-ci\.md\) \|/)
	assert.match(read(ctx, 'README.md'), /\| \[CONV-001\]\(conventions\//)
	assert.equal(generate(ctx, { check: true }).code, 0)
	const lesson = read(ctx, 'lessons/0001-a-guard-only-in-ci.md')
	assert.match(lesson, /^issue: 12$/m)
	assert.match(lesson, /^kind: process$/m)
	assert.match(lesson, /^# Lesson 0001 — A guard only in CI$/m)
	assert.match(newLesson(ctx, 'x', '12', 'oops').errors[0], /--kind/)
	assert.match(newLesson(ctx, 'x', 'twelve', 'product').errors[0], /--issue/)
	assert.equal(newPage(ctx, 'data-and-persistence', 'DP', 'Data and persistence').code, 0)
	const dp = read(ctx, 'data-and-persistence.md')
	assert.match(dp, /^area: data-and-persistence$/m)
	assert.match(dp, /\*\*CON-DP-001\*\*/)
	assert.match(newPage(ctx, 'another', 'DP', 'Another').errors[0], /already/)
	assert.match(read(ctx, 'README.md'), /\[Data and persistence\]\(data-and-persistence\.md\)/)
	assert.equal(generate(ctx, { check: true }).code, 0)
})

test('GivenAnAdrOnARemoteBranch_WhenNextAdr_ThenItsNumberIsCounted', () => {
	const ctx = context()
	git(ctx.cwd, 'init', '-q')
	git(ctx.cwd, 'config', 'user.email', 't@t')
	git(ctx.cwd, 'config', 'user.name', 'T')
	init(ctx, { project: 'Shop' })
	write(ctx, 'decisions/ADR-0007-remote.md', '')
	write(ctx, 'features/x/x.feature', '@REQ-ORD-009\nScenario: x\n')
	git(ctx.cwd, 'add', '.')
	git(ctx.cwd, 'commit', '-q', '-m', 'remote')
	// A remote-tracking ref that holds the records; the working tree then drops them.
	git(ctx.cwd, 'update-ref', 'refs/remotes/origin/other', 'HEAD')
	git(ctx.cwd, 'rm', '-q', '-r', '.spec/decisions/ADR-0007-remote.md', '.spec/features/x')
	git(ctx.cwd, 'commit', '-q', '-m', 'drop')
	assert.equal(run(['next-adr'], ctx.cwd).output[0], '0008')
	newFeature(ctx, 'orders', 'ORD', 'Orders')
	assert.equal(nextClaim(ctx, 'orders').output[0], 'REQ-ORD-010')
})

// --- generate

test('GivenFixture_WhenGeneratedTwice_ThenIdenticalAndCheckFailsOnAHandEdit', () => {
	const ctx = fixture()
	const before = ['README.md', 'traceability.md', 'claims.json'].map((rel) => read(ctx, rel))
	assert.equal(generate(ctx).code, 0)
	assert.deepEqual(
		['README.md', 'traceability.md', 'claims.json'].map((rel) => read(ctx, rel)),
		before,
	)
	assert.equal(generate(ctx, { check: true }).code, 0)
	assert.match(read(ctx, 'README.md'), /\| \[Orders\]\(features\/orders\/orders\.feature\) \| `REQ-ORD` \| 3 \| 1 \| 1 \|/)
	assert.match(read(ctx, 'README.md'), /\| \[0001\]\(lessons\/0001-[^)]+\) \| A sold-out item slipped through \| A sold-out item was ordered\. \| REQ-ORD-002 \| #7 \|/)
	assert.match(read(ctx, 'traceability.md'), /\| REQ-ORD-003 \| The order page shows each line with its price \| orders \| browser \| Built \|/)
	assert.match(read(ctx, 'traceability.md'), /\| REQ-ORD-002 \| .* \| application \| Planned \|/)
	const claims = JSON.parse(read(ctx, 'claims.json'))
	assert.deepEqual(claims.areas, [{ name: 'orders', prefix: 'REQ-ORD', prefixes: ['REQ-ORD'] }])
	assert.deepEqual(claims.claims[0].constraints, ['CON-SO-001'])
	assert.deepEqual(claims.claims[1].citedBy.lessons, ['0001'])
	assert.equal(claims.lessons[0].kind, 'product')
	write(ctx, 'README.md', `${read(ctx, 'README.md')}\nhand edit\n`)
	const stale = generate(ctx, { check: true })
	assert.equal(stale.code, 1)
	assert.match(stale.errors[0], /README\.md::differs/)
	assert.match(messages(ctx), /README\.md:: differs from what `generate` writes/)
})

test('GivenDuplicateClaim_WhenGenerated_ThenRefused', () => {
	const ctx = fixture()
	edit(ctx, 'features/orders/orders.feature', '@REQ-ORD-003', '@REQ-ORD-001')
	const result = generate(ctx)
	assert.equal(result.code, 1)
	assert.match(result.errors[0], /REQ-ORD-001 is already claimed/)
})

// --- check

test('GivenFixture_WhenChecked_ThenNoProblems', () => {
	assert.equal(messages(fixture()), '')
})

test('GivenFreshInit_WhenChecked_ThenOnlyPlaceholdersAreReported', () => {
	const ctx = context()
	init(ctx, { project: 'Shop' })
	const found = messages(ctx)
	assert.match(found, /system-overview\.md:1: a template placeholder is left in "description"/)
	assert.match(found, /CON-SO-001 names no claim/)
	assert.doesNotMatch(found, /links to/)
})

const claimCases: [string, string | RegExp, string, RegExp][] = [
	['no claim tag', '@REQ-ORD-001\n', '', /has no @REQ-<AREA>-NNN claim tag/],
	['two claim tags', '@REQ-ORD-001', '@REQ-ORD-001 @REQ-ORD-009', /carries 2 claim tags/],
	['malformed id', '@REQ-ORD-001', '@REQ-ord-1', /not of the form @REQ-<AREA>-NNN/],
	['duplicate id', '@REQ-ORD-003', '@REQ-ORD-001', /REQ-ORD-001 is already claimed/],
	['undeclared prefix', '@REQ-ORD-003', '@REQ-ZZZ-003', /carries a prefix no area declares or keeps/],
	['ignore without issue', '@ignore @issue-42', '@ignore', /is @ignore and names no @issue-<N>/],
	['issue without ignore', '@ignore @issue-42', '@issue-42', /names an issue but is not @ignore/],
	['malformed issue', '@issue-42', '@issue-abc', /not of the form @issue-<N>/],
	['two whens', 'When the customer places the order\n  Then the order is confirmed', 'When the customer places the order\n  And the customer pays\n  Then the order is confirmed', /has 2 action steps/],
	['nine steps', 'And the basket is empty', 'And the basket is empty\n  And a\n  And b\n  And c\n  And d\n  And e', /has 9 steps; at most 8/],
	['browser mechanics', 'When the customer places the order', 'When the customer clicks the order button', /drives the browser \("clicks"\)/],
	['status code', 'Then the order is refused as invalid', 'Then the order responds with 400', /names a status code \("responds with 400"\)/],
	['three hump identifier', 'And the basket is empty', 'And OrderLineItem is empty', /names a PascalCase identifier \("OrderLineItem"\)/],
	['bare step keyword', 'And the basket is empty', 'And the basket is empty\n  Then', /"Then" is a step keyword with no step/],
	['transport term', 'Then the order is refused as invalid', 'Then the API refuses the order', /names a transport or implementation term \("API"\)/],
	['snake case', 'And the basket is empty', 'And basket_items is empty', /names a snake_case identifier/],
	['banned synonym', 'Given a customer has two items in their basket', 'Given a guest has two items in their basket', /uses "guest", which the glossary bans \(`guest`\)/],
]

for (const [name, from, to, expected] of claimCases) {
	test(`GivenScenarioWith${name.replace(/\W+(\w)/g, (_, c: string) => c.toUpperCase()).replace(/^\w/, (c) => c.toUpperCase())}_WhenChecked_ThenReported`, () => {
		const ctx = fixture()
		edit(ctx, 'features/orders/orders.feature', from, to)
		assert.match(messages(ctx), expected)
	})
}

test('GivenCountsTwoHumpNamesAndDataDriven_WhenChecked_ThenNotLinted', () => {
	const ctx = fixture()
	edit(ctx, 'features/orders/orders.feature', 'Then the order is refused as invalid', 'Then GitHub shows at most 200 characters of a data-driven note')
	const found = messages(ctx)
	assert.doesNotMatch(found, /status code/)
	assert.doesNotMatch(found, /PascalCase/)
	assert.doesNotMatch(found, /drives the browser/)
	edit(ctx, 'features/orders/orders.feature', 'data-driven note', 'note with data-testid="x" and Vite2Plus')
	assert.match(messages(ctx), /drives the browser \("data-testid="\)/)
	assert.match(messages(ctx), /PascalCase identifier \("Vite2Plus"\)/)
})

test('GivenFeatureLevelTags_WhenParsed_ThenEveryScenarioInheritsThem', () => {
	const feature = parseFeature('@ui @smoke\nFeature: Orders\n\n@REQ-ORD-001\nScenario: a\n  Given x\n')
	assert.deepEqual(feature.tags, ['@ui', '@smoke'])
	assert.deepEqual(feature.scenarios[0].tags, ['@ui', '@smoke', '@REQ-ORD-001'])
	const ctx = fixture()
	write(ctx, 'features/orders/orders.feature', `@ui\n${FEATURE}`)
	generate(ctx)
	assert.match(read(ctx, 'traceability.md'), /\| REQ-ORD-001 \| .* \| orders \| browser \| Built \|/)
	assert.match(read(ctx, 'README.md'), /\| `REQ-ORD` \| 3 \| 1 \| 3 \|/)
})

test('GivenRichGherkin_WhenParsedAndChecked_ThenShapeIsReadAndNothingFalselyLinted', () => {
	const rich = `Feature: Orders
Customers place an order.

Background:
  Given the shop is open

Rule: An order needs a basket

@REQ-ORD-001
Scenario: A customer places an order with a note
  Given a customer has these items in their basket
    | item   | count |
    | socks  | 2     |
  When the customer places the order with the note
    \"\"\"
    Please click the bell; HTTP 500 is fine here, data-x="1"
    \"\"\"
  Then the order is confirmed to the customer

@REQ-ORD-002
Scenario Outline: An order is refused for <reason>
  Given a customer has an item that is <state>
  When the customer places the order
  Then the order is refused as invalid

Examples: sold out
  | state    | reason   | note                 |
  | sold out | stock    | clicks the API with 400 |

Examples: withdrawn
  | state     | reason    | note |
  | withdrawn | catalogue | GET  |
`
	const feature = parseFeature(rich)
	assert.deepEqual(feature.background.map((step) => step.text), ['the shop is open'])
	assert.equal(feature.scenarios.length, 2)
	assert.equal(feature.scenarios[0].rule, 'An order needs a basket')
	assert.equal(feature.scenarios[0].steps.length, 3)
	assert.equal(feature.scenarios[1].examples.length, 2)
	assert.deepEqual(feature.scenarios[1].examples[1].headers, ['state', 'reason', 'note'])
	const ctx = fixture()
	write(ctx, 'features/orders/orders.feature', rich)
	generate(ctx)
	const found = messages(ctx)
	assert.doesNotMatch(found, /drives the browser|status code|transport|Examples column "note"/)
	edit(ctx, 'features/orders/orders.feature', '| sold out | stock    |', '| sold out | clicks   |')
	assert.match(messages(ctx), /the Examples column "reason" drives the browser \("clicks"\)/)
})

test('GivenCrlfFiles_WhenChecked_ThenReadAsLf', () => {
	const ctx = fixture()
	for (const rel of ['features/orders/orders.feature', 'features/orders/README.md', 'decisions/ADR-0001-orders-are-priced-at-placement.md']) write(ctx, rel, read(ctx, rel).replace(/\n/g, '\r\n'))
	assert.equal(messages(ctx), '')
})

test('GivenConstraintVerifiedOnlyByAConstraint_WhenCheckedTwice_ThenNeverFalselyEmpty', () => {
	const ctx = fixture()
	write(ctx, 'system-overview.md', page('System overview', 'system-overview', '- **CON-SO-001** A.\n  *Verified by: REQ-ORD-001.*\n- **CON-SO-002** B, with a sub-point.\n  - the sub-point\n  *Verified by: CON-SO-001.*\n- **CON-SO-003** C.\n  *Verified by: CON-SO-001, CON-SO-002.*'))
	generate(ctx)
	const found = messages(ctx)
	assert.doesNotMatch(found, /names no claim/)
	assert.doesNotMatch(found, /has no \*Verified by:\*/)
})

test('GivenGuidePageWithConstraintBullets_WhenChecked_ThenItMustBeSpec', () => {
	const ctx = fixture()
	write(ctx, 'notes.md', '---\ntitle: Notes\ndescription: A guide.\ntype: guide\n---\n\n# Notes\n\n- **CON-NO-001** A rule.\n  *Verified by: none — x.*\n')
	generate(ctx)
	assert.match(messages(ctx), /notes\.md:1: "type: guide" but this path is a spec/)
})

test('GivenGlossaryGlobalRegex_WhenTwoScenariosMatch_ThenBothReported', () => {
	const ctx = fixture()
	edit(ctx, 'glossary.md', '`guest`', '`/guest/gi`')
	edit(ctx, 'features/orders/orders.feature', 'Given a customer has two items in their basket', 'Given a guest has two items in their basket')
	edit(ctx, 'features/orders/orders.feature', 'Given a customer placed an order with <count> items', 'Given a guest placed an order with <count> items')
	assert.equal(checkProblems(ctx).filter((problem) => /glossary bans/.test(problem.message)).length, 2)
})

test('GivenHeadingsWithUnderscoresAndRepeats_WhenAnchored_ThenGitHubSlugs', () => {
	assert.deepEqual([...anchors('# snake_case\n## Same\n## Same\n## Same')], ['snake_case', 'same', 'same-1', 'same-2'])
	const ctx = fixture()
	edit(ctx, 'features/orders/README.md', '## Out of scope', '## Out of scope\n\nx\n\n## Out of scope')
	edit(ctx, 'features/orders/README.md', 'Partial shipments (#9).', '[a](#out-of-scope-1) [b](#out-of-scope-2) [c](%E0%A4%A)')
	const found = messages(ctx)
	assert.doesNotMatch(found, /#out-of-scope-1/)
	assert.match(found, /#out-of-scope-2, and no heading/)
	assert.match(found, /links to %E0%A4%A, which is not a valid URI/)
})

test('GivenMalformedAreaPaths_WhenNewFeature_ThenRefusedAndFileKept', () => {
	const ctx = fixture()
	write(ctx, 'area-paths.json', '{ broken')
	const result = newFeature(ctx, 'returns', 'RET', 'Returns')
	assert.equal(result.code, 1)
	assert.match(result.errors[0], /area-paths\.json is not valid JSON/)
	assert.equal(read(ctx, 'area-paths.json'), '{ broken')
	assert.ok(!existsSync(path(ctx, 'features/returns')))
})

test('GivenAreaWithoutReadme_WhenGenerated_ThenTheMissingReadmeIsNamedNotEveryClaim', () => {
	const ctx = fixture()
	write(ctx, 'features/returns/returns.feature', '@REQ-RET-001\nScenario: a\n  Given x\n\n@REQ-RET-002\nScenario: b\n  Given x\n')
	const result = generate(ctx)
	assert.equal(result.code, 1)
	assert.equal(result.errors.length, 1)
	assert.match(result.errors[0], /area "returns" has no README\.md/)
})

test('GivenQuotedOrPlaceholderText_WhenChecked_ThenNotLinted', () => {
	const ctx = fixture()
	edit(ctx, 'features/orders/orders.feature', 'Then the order is refused as invalid', 'Then the page says "Click to retry" and offers <action>')
	assert.doesNotMatch(messages(ctx), /drives the browser/)
})

test('GivenBannedSynonymInAreaReadme_WhenChecked_ThenReportedButNotInCodeOrQuotes', () => {
	const ctx = fixture()
	edit(ctx, 'features/orders/README.md', 'Partial shipments (#9).', 'A guest cannot order; "guest" in quotes and `guest` in code are fine.')
	const found = checkProblems(ctx).filter((problem) => /glossary bans/.test(problem.message))
	assert.equal(found.length, 1)
	assert.equal(found[0].line, 17)
})

test('GivenGlossaryRegexAndExemptArea_WhenChecked_ThenHonoured', () => {
	const ctx = fixture()
	write(ctx, 'glossary.md', `---
title: Glossary
description: Words.
type: spec
area: glossary
---

# Glossary

| Term | Definition | Banned in scenarios | Exempt areas |
|---|---|---|---|
| basket | the basket | \`/cart(s)?/i\` | |
| customer | the customer | \`buyer\` | orders |
`)
	edit(ctx, 'features/orders/orders.feature', 'Given a customer has two items in their basket', 'Given a buyer has two items in their cart')
	const found = messages(ctx)
	assert.match(found, /uses "cart", which the glossary bans/)
	assert.doesNotMatch(found, /buyer/)
})

test('GivenKeptPrefixes_WhenChecked_ThenLiveOnesPassAndRetiredOnesCapTheNumber', () => {
	const ctx = fixture()
	newFeature(ctx, 'returns', 'RET', 'Returns')
	write(ctx, 'features/returns/returns.feature', 'Feature: Returns\n\n@REQ-ORD-050\nScenario: Moved here\n  Given a thing\n  Then it holds\n\n@REQ-OLD-005\nScenario: Kept from a split\n  Given a thing\n  Then it holds\n')
	write(ctx, 'features/returns/README.md', README.replace(/title: Orders/, 'title: Returns').replace('area: orders', 'area: returns').replace('prefix: REQ-ORD', 'prefix: REQ-RET\nkeeps: REQ-ORD, REQ-OLD=4').replace('orders.feature', 'returns.feature').replace('# Orders', '# Returns'))
	generate(ctx)
	let found = messages(ctx)
	assert.match(found, /REQ-OLD-005 is above REQ-OLD's last issued number 004/)
	assert.doesNotMatch(found, /REQ-ORD-050/)
	edit(ctx, 'features/returns/README.md', 'keeps: REQ-ORD, REQ-OLD=4', 'keeps: REQ-ORD=3, REQ-OLD')
	found = messages(ctx)
	assert.match(found, /REQ-ORD is still issued by orders/)
	assert.match(found, /a kept prefix no area issues needs its last number/)
	edit(ctx, 'features/returns/README.md', /keeps: [^\n]*\n/, '')
	assert.match(messages(ctx), /REQ-ORD-050 carries orders's prefix; a moved scenario's area lists it under "keeps:"/)
})

test('GivenAreaWithoutPrefixOrFiles_WhenChecked_ThenReported', () => {
	const ctx = fixture()
	edit(ctx, 'features/orders/README.md', 'prefix: REQ-ORD\n', '')
	assert.match(messages(ctx), /declares no "prefix:"/)
	mkdirSync(path(ctx, 'features/empty'))
	const found = messages(ctx)
	assert.match(found, /area "empty" has no empty\.feature/)
	assert.match(found, /area "empty" has no README\.md/)
	assert.match(found, /area "empty" has no entry under "areas"/)
})

test('GivenAreaPathsNamingNoArea_WhenChecked_ThenReported', () => {
	const ctx = fixture()
	write(ctx, 'area-paths.json', '{\n\t"every": [],\n\t"areas": {\n\t\t"orders": [],\n\t\t"ghost": []\n\t}\n}\n')
	assert.match(messages(ctx), /"areas\.ghost" names no feature area/)
	write(ctx, 'area-paths.json', '{')
	assert.match(messages(ctx), /is not valid JSON/)
})

test('GivenConstraintProblems_WhenChecked_ThenEachReported', () => {
	const ctx = fixture()
	write(ctx, 'system-overview.md', page('System overview', 'system-overview', '- **CON-SO-001** A.\n  *Verified by: REQ-ORD-001.*\n- **CON-SO-001** B.\n  *Verified by: REQ-ORD-099.*\n- **CON-SO-003** C.\n- **CON-TQ-004** D.\n  *Verified by: none — x.*\n- **CON-so-5** E.\n  *Verified by: none — x.*'))
	const found = messages(ctx)
	assert.match(found, /CON-SO-001 is already declared/)
	assert.match(found, /CON-SO-001 is verified by REQ-ORD-099, which no scenario claims/)
	assert.match(found, /CON-SO-003 has no \*Verified by:\*/)
	assert.match(found, /uses 3 constraint codes/)
	assert.match(found, /constraint code CON-TQ is already/)
	assert.match(found, /"CON-so-5" is not of the form/)
})

test('GivenAdrOffItsShape_WhenChecked_ThenEachReported', () => {
	const ctx = fixture()
	const adr = 'decisions/ADR-0001-orders-are-priced-at-placement.md'
	edit(ctx, adr, '## Consequences', '## Outcome')
	edit(ctx, adr, '## Decision drivers', '## Related')
	edit(ctx, adr, '**Status:** Accepted.', '**Status:** Superseded.')
	let found = messages(ctx)
	assert.match(found, /"## Outcome" is not a section of a ADR/)
	assert.match(found, /"## Related" is out of order/)
	assert.match(found, /has no "## Consequences" section/)
	assert.match(found, /the status line opens with "Superseded" but the frontmatter says "status: accepted"/)
	edit(ctx, adr, 'status: accepted', 'status: superseded')
	found = messages(ctx)
	assert.match(found, /a superseded record's status line links the ADR or convention that replaced it/)
	edit(ctx, adr, '**Status:** Superseded.', '**Status:** Superseded by ADR-0009.')
	assert.match(messages(ctx), /names ADR-0009, which does not exist/)
	write(ctx, `${adr}`, read(ctx, adr).replace('## Decision\n', '## Amendment (2026-10-05)\n\nx\n\n## Decision\n'))
	assert.match(messages(ctx), /carries an amendment/)
	write(ctx, 'decisions/ADR-0001-another-slug.md', read(ctx, adr))
	assert.match(messages(ctx), /number 1 is already/)
	write(ctx, 'decisions/notes.md', '---\ntitle: x\ndescription: y\ntype: guide\n---\n# x\n')
	assert.match(messages(ctx), /notes\.md:: is neither README\.md nor ADR-NNNN-<slug>\.md/)
})

test('GivenAdrWithoutConsideredOptionsOrStatusLine_WhenChecked_ThenReported', () => {
	const ctx = fixture()
	const adr = 'decisions/ADR-0001-orders-are-priced-at-placement.md'
	edit(ctx, adr, /## Considered options[\s\S]*?(?=## Decision\n)/, '')
	edit(ctx, adr, /\*\*Status:\*\*[^\n]*\n/, 'Status: accepted\n')
	const found = messages(ctx)
	assert.match(found, /has no "## Considered options" section/)
	assert.match(found, /has no `\*\*Status:\*\*` paragraph/)
})

test('GivenLessonKindObligations_WhenChecked_ThenEachReported', () => {
	const ctx = fixture()
	const lesson = 'lessons/0001-a-sold-out-item-slipped-through.md'
	edit(ctx, lesson, 'REQ-ORD-002 added.', 'REQ-ORD-077 added.')
	assert.match(messages(ctx), /"## Spec delta" names REQ-ORD-077, which does not exist/)
	edit(ctx, lesson, 'REQ-ORD-077 added.', 'a guard moved.')
	assert.match(messages(ctx), /a product lesson's "## Spec delta" names the REQ- or CON- ID/)
	edit(ctx, lesson, 'kind: product', 'kind: process')
	assert.match(messages(ctx), /a process lesson's "## Skill" names the skill/)
	edit(ctx, lesson, 'None — the claim is the remedy.', 'Now in CONV-009.')
	assert.match(messages(ctx), /"## Skill" names CONV-009, which does not exist/)
	edit(ctx, lesson, 'Now in CONV-009.', 'Now in `deliver-change`.')
	assert.doesNotMatch(messages(ctx), /Skill/)
	edit(ctx, lesson, 'kind: process', 'kind: incident')
	edit(ctx, lesson, /## Spec delta[\s\S]*/, '')
	assert.doesNotMatch(messages(ctx), /lessons\/0001/)
	edit(ctx, lesson, '## Root cause', '## Cause')
	const found = messages(ctx)
	assert.match(found, /"## Cause" is not a section of a Lesson/)
	assert.match(found, /has no "## Root cause" section/)
	edit(ctx, lesson, 'kind: incident', 'kind: mishap')
	assert.match(messages(ctx), /"kind: mishap" is not one of product, process, incident/)
	edit(ctx, lesson, 'status: accepted', 'status: proposed')
	assert.match(messages(ctx), /"status: proposed" is not one of accepted, superseded/)
})

test('GivenConventionOffItsShape_WhenChecked_ThenReported', () => {
	const ctx = fixture()
	const conv = 'conventions/CONV-001-a-scenario-is-written-before-its-code.md'
	edit(ctx, conv, '## Why', '## Because')
	const found = messages(ctx)
	assert.match(found, /"## Because" is not a section of a CONV/)
	assert.match(found, /has no "## Why" section/)
	edit(ctx, conv, '# CONV-001 — A scenario', '# CONV-002 — A scenario')
	assert.match(messages(ctx), /the heading is "# CONV-001 — <title>"/)
})

test('GivenFrontmatterProblems_WhenChecked_ThenEachReported', () => {
	const ctx = fixture()
	write(ctx, 'notes.md', '# no frontmatter\n')
	write(ctx, 'other.md', '---\ntitle: x\ndescription:\ntype: poem\n---\n# x\n')
	edit(ctx, 'glossary.md', 'type: spec', 'type: guide')
	edit(ctx, 'features/orders/README.md', 'area: orders', 'area: order')
	const found = messages(ctx)
	assert.match(found, /notes\.md:1: no YAML frontmatter block/)
	assert.match(found, /other\.md:1: frontmatter has no "description"/)
	assert.match(found, /"type: poem" is not one of/)
	assert.match(found, /glossary\.md:1: "type: guide" but this path is a spec/)
	assert.match(found, /"area: order" does not name its directory "orders"/)
})

test('GivenPlaceholdersLeft_WhenChecked_ThenTitleDescriptionHeadingAndStatusLineReported', () => {
	const ctx = fixture()
	const adr = 'decisions/ADR-0001-orders-are-priced-at-placement.md'
	edit(ctx, adr, 'description: Prices are fixed when the order is placed.', 'description: <what was decided>')
	edit(ctx, adr, '# ADR-0001 — Orders are priced at placement', '# ADR-0001 — <the decision>')
	edit(ctx, adr, 'title: Orders are priced at placement', 'title: <the decision>')
	edit(ctx, adr, 'in #3.', 'in <issue link>.')
	const found = messages(ctx)
	assert.match(found, /a template placeholder is left in "description"/)
	assert.match(found, /a template placeholder is left in "title"/)
	assert.match(found, /a template placeholder is left in the heading/)
	assert.match(found, /a template placeholder is left in the status line/)
})

test('GivenLinksImagesAndFences_WhenChecked_ThenEachReported', () => {
	const ctx = fixture()
	const readme = 'features/orders/README.md'
	edit(ctx, readme, 'Partial shipments (#9).', 'See [the ADR](../../decisions/ADR-0002-missing.md), [the index](../../README.md#nowhere), and [the lessons](../../README.md#lessons).\n\n![diagram](diagram.png)\n\n```plantuml\n@startuml\n```\n\n```mermaid\nflowchart LR\n  a --> b\n```\n\n`![not an image](x.png)` and `[not a link](nowhere.md)`')
	const found = messages(ctx)
	assert.match(found, /links to \.\.\/\.\.\/decisions\/ADR-0002-missing\.md, which does not exist/)
	assert.match(found, /links to \.\.\/\.\.\/README\.md#nowhere, and no heading there has that anchor/)
	assert.doesNotMatch(found, /README\.md#lessons/)
	assert.match(found, /an image — every diagram is a fenced mermaid block/)
	assert.match(found, /a plantuml fence/)
	assert.doesNotMatch(found, /nowhere\.md/)
	assert.doesNotMatch(found, /x\.png/)
	assert.equal(checkProblems(ctx).filter((problem) => /image/.test(problem.message)).length, 1)
})

test('GivenNoSpecDirectory_WhenChecked_ThenSaysToInit', () => {
	const ctx = context()
	assert.match(messages(ctx), /is not a directory — run `init`/)
	assert.match(run(['generate'], ctx.cwd).errors[0], /run `init`/)
})

// --- coverage

function git(cwd: string, ...args: string[]): string {
	return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

/** The fixture committed on `main`, mapped to `src/orders/**`, with one more commit on a branch. */
function repo(change: (ctx: Context) => void): Context {
	const ctx = fixture()
	write(ctx, 'area-paths.json', '{\n\t"every": ["src/shared/**"],\n\t"areas": {\n\t\t"orders": ["src/orders/**"]\n\t}\n}\n')
	mkdirSync(join(ctx.cwd, 'src', 'orders'), { recursive: true })
	writeFileSync(join(ctx.cwd, 'src', 'orders', 'place.ts'), 'export const a = 1\n')
	git(ctx.cwd, 'init', '-q', '-b', 'main')
	git(ctx.cwd, 'config', 'user.email', 't@t')
	git(ctx.cwd, 'config', 'user.name', 'T')
	git(ctx.cwd, 'add', '.')
	git(ctx.cwd, 'commit', '-q', '-m', 'base')
	git(ctx.cwd, 'checkout', '-q', '-b', 'work')
	change(ctx)
	git(ctx.cwd, 'add', '.')
	git(ctx.cwd, 'commit', '-q', '-m', 'change')
	return ctx
}

const touchCode = (ctx: Context): void => writeFileSync(join(ctx.cwd, 'src', 'orders', 'place.ts'), 'export const a = 2\n')

test('GivenNoMappedChange_WhenCoverage_ThenPasses', () => {
	const ctx = repo((ctx) => writeFileSync(join(ctx.cwd, 'notes.txt'), 'x'))
	const result = coverage(ctx, 'main')
	assert.equal(result.code, 0, result.errors.join('\n'))
	assert.match(result.output[0], /nothing to cover/)
})

test('GivenMappedChangeWithScenarioChange_WhenCoverage_ThenPasses', () => {
	const ctx = repo((ctx) => {
		touchCode(ctx)
		edit(ctx, 'features/orders/orders.feature', 'Then the order is refused as invalid', 'Then the order is refused as invalid\n  And nothing is charged')
	})
	const result = coverage(ctx, 'main')
	assert.equal(result.code, 0, result.errors.join('\n'))
	assert.match(result.output[0], /scenario text changed in orders/)
})

test('GivenMappedChangeWithOnlyACommentChange_WhenCoverage_ThenFails', () => {
	const ctx = repo((ctx) => {
		touchCode(ctx)
		edit(ctx, 'features/orders/orders.feature', 'Feature: Orders\n', 'Feature: Orders\n# a comment\n\n')
	})
	const result = coverage(ctx, 'main')
	assert.equal(result.code, 1)
	assert.match(result.errors[0], /no scenario changed in orders \(src\/orders\/place\.ts\)/)
})

test('GivenEveryPathChange_WhenCoverage_ThenEveryAreaIsMapped', () => {
	const ctx = repo((ctx) => {
		mkdirSync(join(ctx.cwd, 'src', 'shared'), { recursive: true })
		writeFileSync(join(ctx.cwd, 'src', 'shared', 'core.ts'), 'x')
	})
	assert.match(coverage(ctx, 'main').errors[0], /no scenario changed in orders \(src\/shared\/core\.ts\)/)
})

test('GivenScenarioOnlyDiff_WhenCoverage_ThenPasses', () => {
	const ctx = repo((ctx) => edit(ctx, 'features/orders/orders.feature', 'Then the order is refused as invalid', 'Then the order is refused as invalid\n  And nothing is charged'))
	// Only the specification changed: no code is mapped, so there is nothing a scenario must cover.
	const result = coverage(ctx, 'main')
	assert.equal(result.code, 0, result.errors.join('\n'))
	assert.match(result.output[0], /nothing to cover/)
})

test('GivenExemption_WhenCoverage_ThenJudgedByItsClaims', () => {
	const ctx = repo(touchCode)
	const body = join(ctx.cwd, 'body.md')
	writeFileSync(body, 'Refactor.\n\nNo .feature scenario needed: refactor — moved the pricing loop\nClaims preserved: REQ-ORD-001\n')
	const good = coverage(ctx, 'main', 'body.md')
	assert.equal(good.code, 0, good.errors.join('\n'))
	assert.match(good.output[0], /exempt as refactor/)
	writeFileSync(body, 'No .feature scenario needed: refactor — moved it\nClaims preserved: REQ-ORD-099\n')
	assert.match(coverage(ctx, 'main', 'body.md').errors[0], /REQ-ORD-099 is not a claim/)
	writeFileSync(body, 'No .feature scenario needed: copy — reworded\nClaims preserved: REQ-ORD-001\n')
	assert.match(coverage(ctx, 'main', 'body.md').errors[0], /malformed: "copy" is not an exemption category/)
	assert.match(coverage(ctx, 'nope').errors[0], /git diff nope\.\.\.HEAD failed/)
})

// --- command line

test('GivenCommandLine_WhenRun_ThenRoutesAndReportsUsage', () => {
	const ctx = context()
	assert.match(run([], ctx.cwd).output[0], /^sdd\.ts — /)
	assert.match(run(['wat'], ctx.cwd).errors[0], /unknown command "wat"/)
	assert.match(run(['new', 'thing'], ctx.cwd).errors[0], /new what\?/)
	assert.match(run(['generate', '--check', 'foo'], ctx.cwd).errors[0], /generate does not take "foo"/)
	assert.match(run(['check', 'extra'], ctx.cwd).errors[0], /check does not take "extra"/)
	assert.equal(run(['init', '--project', 'Shop', '--root', 'spec'], ctx.cwd).code, 0)
	assert.ok(existsSync(join(ctx.cwd, 'spec', 'features', 'README.md')))
	assert.equal(run(['new', 'feature', 'orders', '--prefix', 'ORD', '--title', 'Orders', '--root', 'spec'], ctx.cwd).code, 0)
	assert.equal(run(['next-claim', 'orders', '--root', 'spec'], ctx.cwd).output[0], 'REQ-ORD-001')
	// Every `new …` regenerates, so the generated files are current without a separate generate.
	assert.equal(run(['generate', '--check', '--root', 'spec'], ctx.cwd).code, 0)
	writeFileSync(join(ctx.cwd, 'spec', 'README.md'), 'stale')
	assert.equal(run(['generate', '--check', '--root', 'spec'], ctx.cwd).code, 1)
	assert.equal(run(['generate', '--root', 'spec'], ctx.cwd).code, 0)
	assert.equal(run(['generate', '--check', '--root', 'spec'], ctx.cwd).code, 0)
})
