import assert from 'node:assert/strict'
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { checkTargets, main, parseSkillfile, planMoves } from '../tools/refresh-install.ts'

const SKILLFILE = `# comment
install  claude-code  global

local  agent  agents/critic.md
local  agent  reviewer  agents/other.md   # trailing comment
github  agent  Owner/repo  agents/pinned.md
github  skill  Owner/repo  skills/pinned
local  skill  review-work  skills/review-work/SKILL.md
local  skill  skills/unnamed/SKILL.md
`

test('GivenSkillfile_WhenParsed_ThenLocalsNamedAndGithubIgnored', () => {
	const parsed = parseSkillfile(SKILLFILE)
	assert.deepEqual(parsed.installs, [{ platform: 'claude-code', scope: 'global' }])
	assert.deepEqual(parsed.locals, [
		{ kind: 'agent', name: 'critic' },
		{ kind: 'agent', name: 'reviewer' },
		{ kind: 'skill', name: 'review-work' },
		{ kind: 'skill', name: 'unnamed' },
	])
})

test('GivenLocals_WhenPlanned_ThenPathsSitDirectlyUnderClaudeDirs', () => {
	const home = mkdtempSync(join(tmpdir(), 'ri-'))
	assert.deepEqual(planMoves(parseSkillfile(SKILLFILE).locals, home), [
		{ kind: 'agent', target: join(home, '.claude/agents/critic.md') },
		{ kind: 'agent', target: join(home, '.claude/agents/reviewer.md') },
		{ kind: 'skill', target: join(home, '.claude/skills/review-work') },
		{ kind: 'skill', target: join(home, '.claude/skills/unnamed') },
	])
})

test('GivenUnnamedSkills_WhenParsed_ThenNameInferredFromFileDirectoryOrTrailingSlash', () => {
	const parsed = parseSkillfile('local skill skills/a/SKILL.md\nlocal skill skills/b\nlocal skill skills/c/\nlocal agent agents/d.md\nlocal agent agents/e\n')
	assert.deepEqual(parsed.locals.map((entry) => entry.name), ['a', 'b', 'c', 'd', 'e'])
})

test('GivenComments_WhenParsed_ThenOnlyHashAtStartOrAfterWhitespaceStartsOne', () => {
	const parsed = parseSkillfile('local agent agents/a#b.md\nlocal agent x agents/x.md #note\n  # indented\nlocal agent agents/y.md#z # it\'s a comment\n')
	assert.deepEqual(parsed.locals, [
		{ kind: 'agent', name: 'a#b' },
		{ kind: 'agent', name: 'x' },
		{ kind: 'agent', name: 'y.md#z' },
	])
})

test('GivenQuoteInLine_WhenParsed_ThenRefused', () => {
	assert.throws(() => parseSkillfile('local agent "a b" agents/x.md'), /quote/)
	assert.throws(() => parseSkillfile("github agent Owner/repo 'x'"), /quote/)
})

test('GivenUnknownPlatformOrScope_WhenChecked_ThenRefused', () => {
	assert.equal(checkTargets([{ platform: 'claude-code', scope: 'global' }]).length, 0)
	assert.equal(checkTargets([{ platform: 'cursor', scope: 'global' }]).length, 1)
	assert.equal(checkTargets([{ platform: 'claude-code', scope: 'project' }]).length, 1)
	assert.equal(checkTargets([]).length, 1)
})

test('GivenEscapingName_WhenPlanned_ThenRefused', () => {
	const home = mkdtempSync(join(tmpdir(), 'ri-'))
	for (const name of ['../../etc', 'a/b', '..', '']) {
		assert.throws(() => planMoves([{ kind: 'skill', name }], home), /refusing/)
		assert.throws(() => planMoves([{ kind: 'agent', name }], home), /refusing/)
	}
})

function backupDir(home: string): string {
	const root = join(home, '.claude/.refresh-install-backup')
	const entries = readdirSync(root)
	assert.equal(entries.length, 1)
	return join(root, entries[0])
}

function sandbox(skillfile: string) {
	const root = mkdtempSync(join(tmpdir(), 'ri-'))
	const home = join(root, 'home')
	const cwd = join(root, 'repo')
	const bin = join(root, 'bin')
	for (const directory of [join(home, '.claude/agents'), join(home, '.claude/skills/review-work'), join(home, '.claude/skills/other'), cwd, bin]) mkdirSync(directory, { recursive: true })
	writeFileSync(join(cwd, 'Skillfile'), skillfile)
	writeFileSync(join(home, '.claude/agents/critic.md'), 'stale')
	writeFileSync(join(home, '.claude/agents/keep.md'), 'keep')
	writeFileSync(join(home, '.claude/skills/review-work/SKILL.md'), 'stale')
	writeFileSync(join(home, '.claude/skills/other/SKILL.md'), 'keep')
	writeFileSync(join(home, '.claude/settings.json'), '{}')
	const log = join(root, 'invoked')
	const fake = join(bin, 'skillfile')
	writeFileSync(fake, `#!/bin/sh\n[ "$1" = "--version" ] && exit 0\necho "$@ $PWD" >> "${log}"\n[ -n "$FAKE_DEPLOY" ] && echo deployed > "$FAKE_DEPLOY"\nexit \${FAKE_EXIT:-0}\n`)
	chmodSync(fake, 0o755)
	return { home, cwd, bin, log }
}

test('GivenStaleCopies_WhenRun_ThenOnlyDeclaredLocalsMovedToBackupAndInstallInvoked', () => {
	const { home, cwd, bin, log } = sandbox(SKILLFILE)
	const code = main({ cwd, home, dryRun: false, skillfileCommand: join(bin, 'skillfile') })
	assert.equal(code, 0)
	assert.equal(existsSync(join(home, '.claude/agents/critic.md')), false)
	assert.equal(existsSync(join(home, '.claude/skills/review-work')), false)
	assert.equal(existsSync(join(home, '.claude/agents/keep.md')), true)
	assert.equal(existsSync(join(home, '.claude/skills/other/SKILL.md')), true)
	assert.equal(existsSync(join(home, '.claude/settings.json')), true)
	assert.match(readFileSync(log, 'utf8'), /^install /)
	const backup = backupDir(home)
	assert.equal(readFileSync(join(backup, 'agents/critic.md'), 'utf8'), 'stale')
	assert.equal(readFileSync(join(backup, 'skills/review-work/SKILL.md'), 'utf8'), 'stale')
})

test('GivenDryRun_WhenRun_ThenNothingMovedOrInstalled', () => {
	const { home, cwd, bin, log } = sandbox(SKILLFILE)
	assert.equal(main({ cwd, home, dryRun: true, skillfileCommand: join(bin, 'skillfile') }), 0)
	assert.equal(existsSync(join(home, '.claude/agents/critic.md')), true)
	assert.equal(existsSync(log), false)
})

test('GivenUnsupportedTarget_WhenRun_ThenRefusedWithoutMoving', () => {
	const { home, cwd, bin, log } = sandbox(SKILLFILE.replace('claude-code  global', 'cursor  global'))
	assert.equal(main({ cwd, home, dryRun: false, skillfileCommand: join(bin, 'skillfile') }), 1)
	assert.equal(existsSync(join(home, '.claude/agents/critic.md')), true)
	assert.equal(existsSync(log), false)
})

test('GivenSkillfileFails_WhenRun_ThenItsExitCodePropagates', () => {
	const { home, cwd, bin } = sandbox(SKILLFILE)
	process.env.FAKE_EXIT = '7'
	try {
		assert.equal(main({ cwd, home, dryRun: false, skillfileCommand: join(bin, 'skillfile') }), 7)
	} finally {
		delete process.env.FAKE_EXIT
	}
})

test('GivenCli_WhenRunWithSandboxHomeAndFakeSkillfile_ThenExitsZero', () => {
	const { home, cwd, bin } = sandbox(SKILLFILE)
	const script = join(import.meta.dirname, '../tools/refresh-install.ts')
	const result = spawnSync(process.execPath, [script], { cwd, env: { ...process.env, HOME: home, PATH: `${bin}:${process.env.PATH}` }, encoding: 'utf8' })
	assert.equal(result.status, 0, result.stderr)
	assert.equal(existsSync(join(home, '.claude/agents/critic.md')), false)
})

test('GivenMissingSkillfileBinary_WhenRun_ThenNothingMoved', () => {
	const { home, cwd, bin } = sandbox(SKILLFILE)
	assert.equal(main({ cwd, home, dryRun: false, skillfileCommand: join(bin, 'nope') }), 1)
	assert.equal(existsSync(join(home, '.claude/agents/critic.md')), true)
	assert.equal(existsSync(join(home, '.claude/.refresh-install-backup')), false)
})

test('GivenMoveFailsPartway_WhenRun_ThenMovedCopiesRestoredAndInstallNotRun', () => {
	const { home, cwd, bin, log } = sandbox(SKILLFILE)
	let calls = 0
	const rename = (from: string, to: string) => {
		calls += 1
		if (calls === 2) throw new Error('boom')
		renameSync(from, to)
	}
	assert.equal(main({ cwd, home, dryRun: false, skillfileCommand: join(bin, 'skillfile'), rename }), 1)
	assert.equal(readFileSync(join(home, '.claude/agents/critic.md'), 'utf8'), 'stale')
	assert.equal(existsSync(join(home, '.claude/skills/review-work/SKILL.md')), true)
	assert.equal(existsSync(log), false)
})

test('GivenInstallFails_WhenRun_ThenMissingCopiesRestoredAndDeployedOnesKept', () => {
	const { home, cwd, bin } = sandbox(SKILLFILE)
	process.env.FAKE_EXIT = '3'
	process.env.FAKE_DEPLOY = join(home, '.claude/agents/critic.md')
	try {
		assert.equal(main({ cwd, home, dryRun: false, skillfileCommand: join(bin, 'skillfile') }), 3)
	} finally {
		delete process.env.FAKE_EXIT
		delete process.env.FAKE_DEPLOY
	}
	assert.equal(readFileSync(join(home, '.claude/agents/critic.md'), 'utf8').trim(), 'deployed')
	assert.equal(readFileSync(join(home, '.claude/skills/review-work/SKILL.md'), 'utf8'), 'stale')
	assert.equal(readFileSync(join(backupDir(home), 'agents/critic.md'), 'utf8'), 'stale')
})

test('GivenSymlinkTarget_WhenRun_ThenLinkMovedAndItsTargetUntouched', () => {
	const { home, cwd, bin } = sandbox(SKILLFILE)
	const outside = mkdtempSync(join(tmpdir(), 'ri-outside-'))
	writeFileSync(join(outside, 'precious.txt'), 'precious')
	rmSync(join(home, '.claude/skills/review-work'), { recursive: true })
	symlinkSync(outside, join(home, '.claude/skills/review-work'))
	assert.equal(main({ cwd, home, dryRun: false, skillfileCommand: join(bin, 'skillfile') }), 0)
	assert.throws(() => lstatSync(join(home, '.claude/skills/review-work')))
	assert.equal(lstatSync(join(backupDir(home), 'skills/review-work')).isSymbolicLink(), true)
	assert.equal(readFileSync(join(outside, 'precious.txt'), 'utf8'), 'precious')
})

test('GivenRelativeHome_WhenRun_ThenRefused', () => {
	const { cwd, bin } = sandbox(SKILLFILE)
	assert.equal(main({ cwd, home: 'relative/home', dryRun: false, skillfileCommand: join(bin, 'skillfile') }), 1)
	assert.equal(main({ cwd, home: 'relative/home', dryRun: true }), 1)
})

test('GivenSameNameUserSkill_WhenRun_ThenItEndsUpInBackupNotGone', () => {
	const { home, cwd, bin } = sandbox(SKILLFILE)
	writeFileSync(join(home, '.claude/skills/review-work/SKILL.md'), 'my own skill')
	assert.equal(main({ cwd, home, dryRun: false, skillfileCommand: join(bin, 'skillfile') }), 0)
	assert.equal(readFileSync(join(backupDir(home), 'skills/review-work/SKILL.md'), 'utf8'), 'my own skill')
})
