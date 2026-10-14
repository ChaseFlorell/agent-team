import assert from 'node:assert/strict'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { checkTargets, main, parseSkillfile, planRemovals } from '../tools/refresh-install.ts'

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
	assert.deepEqual(planRemovals(parseSkillfile(SKILLFILE).locals, home).slice(0, 3), [
		join(home, '.claude/agents/critic.md'),
		join(home, '.claude/agents/reviewer.md'),
		join(home, '.claude/skills/review-work'),
	])
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
		assert.throws(() => planRemovals([{ kind: 'skill', name }], home), /refusing/)
		assert.throws(() => planRemovals([{ kind: 'agent', name }], home), /refusing/)
	}
})

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
	writeFileSync(fake, `#!/bin/sh\necho "$@ $PWD" >> "${log}"\nexit \${FAKE_EXIT:-0}\n`)
	chmodSync(fake, 0o755)
	return { home, cwd, bin, log }
}

test('GivenStaleCopies_WhenRun_ThenOnlyDeclaredLocalsRemovedAndInstallInvoked', () => {
	const { home, cwd, bin, log } = sandbox(SKILLFILE)
	const code = main({ cwd, home, dryRun: false, skillfileCommand: join(bin, 'skillfile') })
	assert.equal(code, 0)
	assert.equal(existsSync(join(home, '.claude/agents/critic.md')), false)
	assert.equal(existsSync(join(home, '.claude/skills/review-work')), false)
	assert.equal(existsSync(join(home, '.claude/agents/keep.md')), true)
	assert.equal(existsSync(join(home, '.claude/skills/other/SKILL.md')), true)
	assert.equal(existsSync(join(home, '.claude/settings.json')), true)
	assert.match(readFileSync(log, 'utf8'), /^install /)
})

test('GivenDryRun_WhenRun_ThenNothingRemovedOrInstalled', () => {
	const { home, cwd, bin, log } = sandbox(SKILLFILE)
	assert.equal(main({ cwd, home, dryRun: true, skillfileCommand: join(bin, 'skillfile') }), 0)
	assert.equal(existsSync(join(home, '.claude/agents/critic.md')), true)
	assert.equal(existsSync(log), false)
})

test('GivenUnsupportedTarget_WhenRun_ThenRefusedWithoutRemoving', () => {
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
