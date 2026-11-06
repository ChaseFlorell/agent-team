import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { hookScript } from './hook-script.ts'

const hasJq = spawnSync('jq', ['--version']).status === 0
const skip = hasJq ? false : 'jq is not installed'

const bashGuard = hookScript('agents/records-keeper.md', 0)

/** Runs the hook as Claude Code would: the tool call as JSON on stdin, through `sh -c`. */
function bash(command: string) {
	return spawnSync('sh', ['-c', bashGuard], { input: JSON.stringify({ tool_input: { command } }), encoding: 'utf8' })
}

const blocked = [
	'git add .',
	'git commit -m x',
	'git push',
	'git stash',
	'git merge main',
	'git rebase main',
	'git tag v1',
	'gh issue create',
	'gh issue comment 1 -b x',
	'gh issue edit 1 --add-label x',
	'gh issue close 1',
	'gh pr comment 1 -b x',
	'gh pr create',
	'gh api -X POST repos/o/r/issues/1/comments',
	'gh api graphql -f query=x',
	'gh api search/issues -f q=x',
	'gh label create x',
	'gh release create v1',
	'git -c alias.x=y log',
	'GIT_DIR=x git log',
	"GH_BROWSER=$'gh\\x20label\\x20create\\x20x' gh release view v1 --web",
	"BROWSER=$'gh\\x20label\\x20create\\x20x' gh search issues x --web",
	"GH_PAGER=x gh issue view 1",
	"export PAGER=x; gh issue list",
	'eval gh issue create',
]

const allowed = [
	'gh issue list --state all --search x',
	'gh issue view 1 --comments',
	'gh pr view 1 --comments',
	'gh pr list --state all',
	'gh search issues x --state closed',
	'gh search prs x',
	'gh search commits x',
	'gh search code x',
	'gh label list',
	'gh release list',
	'gh release view v1',
	'gh api repos/o/r/issues/1/timeline',
	'gh api repos/o/r/issues/1/sub_issues',
	'gh api repos/o/r/issues/1/dependencies/blocked_by',
	'gh api -X GET search/issues -f q=x',
	'git log --oneline',
	'git blame f',
	'git show abc',
	'grep -rn x .',
]

for (const command of blocked) {
	test(`GivenBlockedCommand_WhenHookRuns_ThenExit2: ${JSON.stringify(command)}`, { skip }, () => {
		assert.equal(bash(command).status, 2)
	})
}

for (const command of allowed) {
	test(`GivenAllowedCommand_WhenHookRuns_ThenExit0: ${JSON.stringify(command)}`, { skip }, () => {
		const result = bash(command)
		assert.equal(result.status, 0, result.stderr)
	})
}

test('GivenBlockedCommand_WhenHookRuns_ThenMessageNamesHeather', { skip }, () => {
	const result = bash('gh issue create')
	assert.equal(result.status, 2)
	assert.match(result.stderr, /Heather/)
	assert.doesNotMatch(result.stderr, /Becky/)
})

test('GivenVerifierGuard_WhenCompared_ThenHeathersCopyDiffersOnlyByNameCommentAndAllowlist', () => {
	const normalize = (script: string) =>
		script
			.split('\n')
			.filter((line) => !line.includes("copied from the verifier's guard"))
			.join('\n')
			.replaceAll('Heather', 'Becky')
			.replace('|search (issues|prs|commits|code|repos)|label list|release (view|list)', '')
	assert.equal(normalize(bashGuard), hookScript('agents/verifier.md', 1))
})
