import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { checkFile, main, parseFrontmatter, upstreamSkills } from '../tools/check-frontmatter.ts'

const agent = (extra = '', model = 'sonnet', effort = 'medium') => `---\nname: x\ndescription: d\nmodel: ${model}\neffort: ${effort}\n${extra}---\nbody\n`
const known = new Set(['agent-persona', 'cucumber-best-practices'])

test('GivenValidAgent_WhenChecked_ThenNoProblems', () => {
	assert.deepEqual(checkFile('agents/x.md', agent('skills:\n  - agent-persona\nisolation: worktree\n'), known), [])
})

test('GivenAgentMissingEffort_WhenChecked_ThenReportsIt', () => {
	const text = '---\nname: x\ndescription: d\nmodel: opus\n---\n'
	assert.match(checkFile('agents/x.md', text).join('\n'), /missing "effort"/)
})

test('GivenAgentWithUnknownKey_WhenChecked_ThenRefusesIt', () => {
	assert.match(checkFile('agents/x.md', agent('type: agent\n')).join('\n'), /"type" is not a key an? agent carries/)
})

test('GivenBadModelOrEffort_WhenChecked_ThenRefusesValue', () => {
	const problems = checkFile('agents/x.md', agent('', 'gpt-4', 'huge')).join('\n')
	assert.match(problems, /model: gpt-4/)
	assert.match(problems, /effort: huge/)
})

test('GivenNumericEffortAndClaudeModel_WhenChecked_ThenAccepted', () => {
	assert.deepEqual(checkFile('agents/x.md', agent('', 'claude-opus-4.5', '5')), [])
})

test('GivenEmptyValue_WhenChecked_ThenReportsEmpty', () => {
	assert.match(checkFile('agents/x.md', agent().replace('description: d', 'description:')).join('\n'), /"description" is declared but empty/)
})

test('GivenDuplicateKey_WhenChecked_ThenReportsIt', () => {
	assert.match(checkFile('agents/x.md', agent('name: y\n')).join('\n'), /"name" is declared twice/)
})

test('GivenSkillWithExactKeys_WhenChecked_ThenNoProblems', () => {
	assert.deepEqual(checkFile('skills/a/SKILL.md', '---\nname: a\ndescription: d\n---\n'), [])
})

test('GivenSkillWithExtraKey_WhenChecked_ThenRefusesIt', () => {
	assert.match(checkFile('skills/a/SKILL.md', '---\nname: a\ndescription: d\nmodel: opus\n---\n').join('\n'), /"model" is not a key a skill carries/)
})

test('GivenSkillMissingDescription_WhenChecked_ThenReportsIt', () => {
	assert.match(checkFile('skills/a/SKILL.md', '---\nname: a\n---\n').join('\n'), /missing "description"/)
})

test('GivenAgentSkillNotKnown_WhenChecked_ThenReportsIt', () => {
	assert.match(checkFile('agents/x.md', agent('skills:\n  - agent-persona\n  - ghost\n'), known).join('\n'), /skill "ghost"/)
})

test('GivenInlineSkillsList_WhenChecked_ThenEachEntryIsChecked', () => {
	assert.match(checkFile('agents/x.md', agent('skills: [agent-persona, ghost]\n'), known).join('\n'), /skill "ghost"/)
})

test('GivenNoFrontmatterOrUnclosed_WhenParsed_ThenError', () => {
	assert.ok(parseFrontmatter('hello').error)
	assert.ok(parseFrontmatter('---\nname: a\n').error)
	assert.ok(parseFrontmatter('---\n\tname: a\n---\n').error)
})

test('GivenOtherPath_WhenChecked_ThenIgnored', () => {
	assert.deepEqual(checkFile('README.md', 'no frontmatter'), [])
})

test('GivenSkillfile_WhenReadUpstream_ThenNamesGithubSkillsOnly', () => {
	const file = [
		'# github  skill  ignored  a/b  c',
		'github  skill  thebushidocollective/han  plugins/x/skills/cucumber-best-practices',
		'github  skill  renamed  o/r  skills/other/',
		'github  agent  o/r  agents/critic.md',
		'local  skill  local-one  skills/local-one/SKILL.md',
	].join('\n')
	assert.deepEqual(upstreamSkills(file), ['cucumber-best-practices', 'renamed'])
})

test('GivenTree_WhenMainRuns_ThenExitCodeFollowsProblems', () => {
	const root = mkdtempSync(join(tmpdir(), 'fm-'))
	mkdirSync(join(root, 'agents'))
	mkdirSync(join(root, 'skills/a'), { recursive: true })
	writeFileSync(join(root, 'skills/a/SKILL.md'), '---\nname: a\ndescription: d\n---\n')
	writeFileSync(join(root, 'Skillfile'), '')
	writeFileSync(join(root, 'agents/x.md'), agent('skills:\n  - a\n'))
	assert.equal(main(root), 0)
	writeFileSync(join(root, 'agents/x.md'), agent('skills:\n  - nope\n'))
	assert.equal(main(root), 1)
})

test('GivenUnquotedColonInValue_WhenChecked_ThenReportsMapping', () => {
	assert.match(checkFile('agents/x.md', agent().replace('description: d', 'description: Jane (DBA): designs schemas')).join('\n'), /"description" holds an unquoted ": "/)
})

test('GivenQuotedColonInValue_WhenChecked_ThenAccepted', () => {
	assert.deepEqual(checkFile('agents/x.md', agent().replace('description: d', 'description: "Jane (DBA): designs schemas"')), [])
})

test('GivenUnquotedHashInValue_WhenChecked_ThenReportsComment', () => {
	assert.match(checkFile('skills/a/SKILL.md', '---\nname: a\ndescription: Use for C #9 work\n---\n').join('\n'), /unquoted " #"/)
})

const hooksBlock = 'hooks:\n  PreToolUse:\n    - matcher: "Bash"\n      hooks:\n        - type: command\n          command: "echo: hi # there"\n'

test('GivenAgentWithNestedHooksBlock_WhenChecked_ThenNoProblems', () => {
	assert.deepEqual(checkFile('agents/x.md', agent(hooksBlock + 'isolation: worktree\n')), [])
})

test('GivenNestedHooksBlock_WhenParsed_ThenNestedKeysAreNotTopLevel', () => {
	const parsed = parseFrontmatter(agent(hooksBlock + 'isolation: worktree\n'))
	assert.deepEqual(parsed.entries?.map((entry) => entry.key), ['name', 'description', 'model', 'effort', 'hooks', 'isolation'])
})

test('GivenHooksBlockAndUnknownKey_WhenChecked_ThenStillRefusesTheKey', () => {
	const problems = checkFile('agents/x.md', agent(hooksBlock + 'type: agent\n')).join('\n')
	assert.match(problems, /"type" is not a key an? agent carries/)
	assert.doesNotMatch(problems, /"hooks" is not a key/)
})

const scalarHooks = (body: string) => `hooks:\n  PreToolUse:\n    - matcher: "Bash"\n      hooks:\n        - type: command\n          command: |\n${body}`

test('GivenBlockScalarCommandWithHashColonAndQuotes_WhenChecked_ThenNoProblems', () => {
	const body = [
		`            c=$(printf '%s' "$in" | jq -r '.tool_input.command // empty')`,
		'            # a comment: with a colon',
		`            echo "Blocked: Kristy never runs '$1'." >&2; exit 2`,
		'            - not a list item',
		'',
		'            exit 0',
	].join('\n')
	assert.deepEqual(checkFile('agents/x.md', agent(scalarHooks(body + '\n') + 'isolation: worktree\n')), [])
})

test('GivenBlockScalarWithDashLines_WhenParsed_ThenNoItemsOnTheKey', () => {
	const parsed = parseFrontmatter(agent(scalarHooks('            - not a list item\n            exit 0\n') + 'isolation: worktree\n'))
	const hooks = parsed.entries?.find((entry) => entry.key === 'hooks')
	assert.deepEqual(hooks?.items, ['type: command'])
	assert.deepEqual(parsed.entries?.map((entry) => entry.key), ['name', 'description', 'model', 'effort', 'hooks', 'isolation'])
})

test('GivenTabInsideBlockScalarContent_WhenParsed_ThenAllowed', () => {
	assert.equal(parseFrontmatter(agent(scalarHooks('            printf "a\tb"\n\t\n            exit 0\n'))).error, undefined)
})

test('GivenTabInBlockScalarIndentation_WhenParsed_ThenRefused', () => {
	assert.match(parseFrontmatter(agent(scalarHooks('            exit 0\n          \texit 1\n'))).error ?? '', /tab/)
})

test('GivenKeyAfterBlockScalar_WhenParsed_ThenReadAsKey', () => {
	const parsed = parseFrontmatter('---\nname: |\n  # not a comment\n  tab\there\ndescription: d\n---\n')
	assert.deepEqual(parsed.entries?.map((entry) => entry.key), ['name', 'description'])
})
