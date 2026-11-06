import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import { hookScript } from './hook-script.ts'

const hasJq = spawnSync('jq', ['--version']).status === 0
const skip = hasJq ? false : 'jq is not installed'

const writeGuard = hookScript('agents/verifier.md', 0)
const bashGuard = hookScript('agents/verifier.md', 1)

/** Runs a hook as Claude Code would: the tool call as JSON on stdin, through `sh -c`. */
function run(script: string, input: object): number | null {
	return spawnSync('sh', ['-c', script], { input: JSON.stringify(input), encoding: 'utf8' }).status
}
const bash = (command: string) => run(bashGuard, { tool_input: { command } })

const blocked = [
	'git add .',
	'git add -A',
	'git commit -m x',
	'git commit --amend',
	'git push',
	'git push origin main',
	'git stash',
	'git stash pop',
	'git am x.patch',
	'git apply --index x.patch',
	'git apply --cached x.patch',
	'git apply -v --index x.patch',
	'git cherry-pick abc',
	'git merge main',
	'git rebase main',
	'git revert abc',
	'git tag v1',
	'git update-index --add x',
	'git update-ref refs/heads/x abc',
	'git commit-tree abc',
	'git notes add -m x',
	'git -C x commit -m x',
	'git -C x push --force',
	'git -c user.name=x commit -m x',
	'git --no-pager add .',
	'git --git-dir x add .',
	'cd x && git commit -m x',
	'cd x; git add .',
	'true || git push',
	"bash -c 'git commit -m x'",
	"sh -c 'cd x && git add .'",
	'FOO=1 git commit -m x',
	'echo hi | xargs git add',
	'git \\\n commit -m x',
	'git status && git push',
	'gh pr create --title x',
	'gh pr create',
	'gh api -X POST repos/o/r/issues/1/comments',
	'gh api repos/o/r/issues/1 --method delete',
	'gh api repos/o/r/issues/1/comments -f body=x',
	'git cp',
	'git checkpoint',
	'git firedrill',
	'git p',
	'git -c alias.x=commit x',
	'git -c core.pager=cat log',
	'git config alias.x commit',
	'git config user.name x',
	'git -C "a b" commit -m x',
	'git -C "a b" cp',
	'"git" commit -m x',
	"'git' commit -m x",
	'\\git commit -m x',
	'/usr/bin/git commit -m x',
	'g=git; $g commit',
	'${g} commit',
	'$(echo git) commit',
	'`echo git` commit',
	'echo "$(git commit -m x)"',
	'eval "git commit -m x"',
	'find . -exec git add {} \\;',
	'git branch -d x',
	'git branch newname',
	'git worktree add x',
	'git remote add o u',
	'git reset --hard',
	'git checkout x',
	'git clean -fd',
	'git apply x.patch',
	'git subtree push --prefix=x o main',
	'git send-email x.patch',
	'git fast-import',
	'gh gist create x',
	'gh repo create x --push',
	'gh release upload v1 f',
	'gh release create v1',
	'gh pr merge 1',
	'gh pr comment 1 -b x',
	'gh api graphql -f query=x',
	'git fetch',
	"git fetch --upload-pack='git commit -m x; git-upload-pack' .",
	"GIT_EXTERNAL_DIFF='git commit -qam ext #' git diff",
	"GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.fsmonitor GIT_CONFIG_VALUE_0='x' git status",
	'env GIT_PAGER=x git log',
	'export GIT_DIR=x; git status',
	"GH_BROWSER='sh -c x' gh pr view 1 --web",
	"BROWSER=$'gh\\x20label\\x20create\\x20x' gh pr view 1 --web",
	"GH_PAGER=x gh pr view 1",
	"export PAGER=x; gh pr list",
	'git diff --ext-diff',
	'git log --textconv',
	'git log --config-env=a.b=C',
	'git diff -c a.b=c',
	'npm version patch',
	'yarn version',
	'pnpm version patch',
]

const allowed = [
	'git status',
	'git diff',
	'git diff --cached',
	'git log --oneline -5',
	'git show HEAD',
	'git rev-parse HEAD',
	'git worktree list',
	'git blame x',
	'git grep add',
	'git -C x status',
	'git merge-base main HEAD',
	'git log --grep commit',
	'git diff | grep push',
	'cd x && git status',
	'mktemp -d',
	'git ls-files',
	'git cat-file -p HEAD',
	'git branch',
	'git branch --list',
	'git branch -l',
	'git branch --show-current',
	'git config --get user.name',
	'git config --list',
	'git config -l',
	'git --no-pager log',
	'git -C x log',
	'git -C "a b" status',
	'node probe.js',
	'npx fast-check',
	'gh pr view 1',
	'gh pr diff 1',
	'gh pr checks 1',
	'gh pr list',
	'gh issue view 1',
	'gh issue list',
	'gh run view 1',
	'gh run list',
	'gh repo view',
	'gh api repos/o/r/pulls',
	'gh api -X GET repos/o/r/pulls -f state=open',
]

for (const command of blocked) {
	test(`GivenBlockedCommand_WhenHookRuns_ThenExit2: ${JSON.stringify(command)}`, { skip }, () => {
		assert.equal(bash(command), 2)
	})
}

for (const command of allowed) {
	test(`GivenAllowedCommand_WhenHookRuns_ThenExit0: ${JSON.stringify(command)}`, { skip }, () => {
		assert.equal(bash(command), 0)
	})
}

const scratch = realpathSync(mkdtempSync(join(tmpdir(), 'verifier-hook-')))
after(() => rmSync(scratch, { recursive: true, force: true }))
const repo = join(scratch, 'repo')
const plain = join(scratch, 'plain')
mkdirSync(repo)
mkdirSync(plain)
if (hasJq) assert.equal(spawnSync('git', ['init', '-q', repo]).status, 0)

const write = (tool_input: object, cwd?: string) => run(writeGuard, { cwd, tool_input })

test('GivenFileInsideRepo_WhenWriteHookRuns_ThenExit2', { skip }, () => {
	assert.equal(write({ file_path: join(repo, 'probe.sh') }), 2)
})

test('GivenNestedPathNotYetCreatedInRepo_WhenWriteHookRuns_ThenExit2', { skip }, () => {
	assert.equal(write({ file_path: join(repo, 'a', 'b', 'probe.sh') }), 2)
})

test('GivenNotebookInsideRepo_WhenWriteHookRuns_ThenExit2', { skip }, () => {
	assert.equal(write({ notebook_path: join(repo, 'p.ipynb') }), 2)
})

test('GivenFileInsideDotGit_WhenWriteHookRuns_ThenExit2', { skip }, () => {
	assert.equal(write({ file_path: join(repo, '.git', 'hooks', 'pre-commit') }), 2)
})

test('GivenSymlinkToFileInRepo_WhenWriteHookRuns_ThenExit2', { skip }, () => {
	writeFileSync(join(repo, 'real.sh'), '')
	symlinkSync(join(repo, 'real.sh'), join(plain, 'abs.sh'))
	symlinkSync('../repo/real.sh', join(plain, 'rel.sh'))
	symlinkSync(join(plain, 'abs.sh'), join(plain, 'chain.sh'))
	for (const f of ['abs.sh', 'rel.sh', 'chain.sh']) assert.equal(write({ file_path: join(plain, f) }), 2, f)
})

test('GivenSymlinkToFileOutsideRepo_WhenWriteHookRuns_ThenExit0', { skip }, () => {
	writeFileSync(join(plain, 'real.sh'), '')
	symlinkSync(join(plain, 'real.sh'), join(plain, 'ok.sh'))
	assert.equal(write({ file_path: join(plain, 'ok.sh') }), 0)
})

test('GivenAncestorWithUnreadableDotGit_WhenWriteHookRuns_ThenExit2', { skip }, () => {
	// an empty .git makes rev-parse fail, as dubious ownership does
	const fake = join(scratch, 'fake')
	mkdirSync(join(fake, '.git'), { recursive: true })
	assert.notEqual(spawnSync('git', ['-C', fake, 'rev-parse', '--is-inside-work-tree']).status, 0)
	assert.equal(write({ file_path: join(fake, 'sub', 'probe.sh') }), 2)
})

test('GivenAncestorWithDotGitFile_WhenWriteHookRuns_ThenExit2', { skip }, () => {
	const fake = join(scratch, 'fake-file')
	mkdirSync(fake)
	writeFileSync(join(fake, '.git'), 'gitdir: /nowhere\n')
	assert.equal(write({ file_path: join(fake, 'probe.sh') }), 2)
})

test('GivenFileOutsideAnyRepo_WhenWriteHookRuns_ThenExit0', { skip }, () => {
	assert.equal(write({ file_path: join(plain, 'probe.sh') }), 0)
})

test('GivenNestedPathNotYetCreatedOutsideRepo_WhenWriteHookRuns_ThenExit0', { skip }, () => {
	assert.equal(write({ file_path: join(plain, 'a', 'b', 'probe.sh') }), 0)
})

test('GivenRelativePathResolvedIntoRepo_WhenWriteHookRuns_ThenExit2', { skip }, () => {
	assert.equal(write({ file_path: 'probe.sh' }, repo), 2)
})

test('GivenRelativePathResolvedOutsideRepo_WhenWriteHookRuns_ThenExit0', { skip }, () => {
	assert.equal(write({ file_path: 'probe.sh' }, plain), 0)
})

test('GivenRelativePathAndNoCwd_WhenWriteHookRuns_ThenExit2', { skip }, () => {
	assert.equal(write({ file_path: 'probe.sh' }), 2)
})

test('GivenNoPath_WhenWriteHookRuns_ThenExit2', { skip }, () => {
	assert.equal(write({}, plain), 2)
})
