import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const hasJq = spawnSync('jq', ['--version']).status === 0
const skip = hasJq ? false : 'jq is not installed'

/** The PreToolUse hook's `command: |` block scalar from the babysitter agent, dedented. */
function hookScript(): string {
	const lines = readFileSync('agents/babysitter.md', 'utf8').split('\n')
	const open = lines.findIndex((line) => /^\s*command:\s*\|[+-]?\s*$/.test(line))
	assert.notEqual(open, -1, 'agents/babysitter.md has no `command: |` hook block')
	const parent = /^ */.exec(lines[open])![0].length
	const body: string[] = []
	for (const line of lines.slice(open + 1)) {
		if (line.trim() !== '' && /^ */.exec(line)![0].length <= parent) break
		body.push(line)
	}
	const first = body.find((line) => line.trim() !== '')!
	const indent = /^ */.exec(first)![0].length
	return body.map((line) => line.slice(indent)).join('\n')
}

/** Runs the hook as Claude Code would: the tool call as JSON on stdin, through `sh -c`. */
function run(command: string): number | null {
	const input = JSON.stringify({ tool_input: { command } })
	return spawnSync('sh', ['-c', hookScript()], { input, encoding: 'utf8' }).status
}

const blocked = [
	'gh pr merge 1',
	'gh pr merge 1 --auto --squash',
	'gh pr close 1',
	'gh pr ready 1',
	'gh pr edit 1 --title x',
	'gh pr comment 1 --body x',
	'gh pr review 1 --approve',
	'gh workflow run ci.yml',
	'gh workflow disable ci.yml',
	'gh run delete 1',
	'gh cache delete 1',
	'gh issue close 1',
	'gh api -X POST repos/o/r/issues/1/comments',
	'gh api repos/o/r/issues/1 --method delete',
	'gh api repos/o/r/issues/1/comments -f body=x',
	'gh api repos/o/r/issues/1/comments -F body=x',
	'git push',
	'git push origin main',
	'git -C x push --force',
	'kill 123',
	'kill -9 123',
	'pkill node',
	'killall node',
	'docker rm abc',
	'docker stop abc',
	'docker kill abc',
	'docker container stop abc',
	'docker compose down',
	'cd x && gh pr merge 1',
	'cd x; gh pr merge 1',
	'true || gh pr merge 1',
	"bash -c 'gh pr merge 1'",
	'FOO=1 gh pr merge 1',
	'echo hi | xargs kill',
	'gh pr \\\n merge 1',
	'gh run view 1 && git push',
]

const allowed = [
	// From skills/watch-builds/SKILL.md, with placeholder ids.
	'gh pr view 1 --json statusCheckRollup,mergeStateStatus,autoMergeRequest',
	'gh pr view 1 --json headRefOid',
	'gh run list --branch feature --json databaseId,name,status,conclusion,event,headSha',
	'gh run list --workflow ci --branch main --status success --limit 10',
	'gh run view 1 --json jobs',
	'gh run view 1 --log-failed',
	'gh run view 1 --json event',
	'gh run view 1 --json workflowName,path',
	'gh run view 1 --json attempt',
	'gh api repos/{owner}/{repo}/check-runs/1/annotations',
	'gh api repos/{owner}/{repo}/contents/.github/workflows/ci.yml --jq .content | base64 -d',
	'gh run rerun 1 --failed',
	'gh run cancel 1',
	'uptime',
	'sysctl -n hw.ncpu',
	'nproc',
	'ps -Ao pid,pcpu,etime,comm',
	'lsof -a -d cwd -p 1 -Fn',
	"docker ps --format '{{.ID}} {{.Names}} {{.Image}} {{.Status}}'",
	'docker stats --no-stream',
	'git worktree list',
	// Blocked words as arguments, not commands.
	'gh run view 1 --log-failed | grep -i kill',
	'gh api repos/o/r/actions/runs | grep -F completed',
	'gh api -X GET repos/o/r/pulls -f state=open',
	'gh api --method GET repos/o/r/pulls -F per_page=5',
]

for (const command of blocked) {
	test(`GivenBlockedCommand_WhenHookRuns_ThenExit2: ${JSON.stringify(command)}`, { skip }, () => {
		assert.equal(run(command), 2)
	})
}

for (const command of allowed) {
	test(`GivenAllowedCommand_WhenHookRuns_ThenExit0: ${JSON.stringify(command)}`, { skip }, () => {
		assert.equal(run(command), 0)
	})
}
