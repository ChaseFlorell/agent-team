#!/usr/bin/env node
// Redeploy every `local` entry of the Skillfile.
//
// `skillfile install` never overwrites a local agent or skill already present
// in ~/.claude (upstream eljulians/skillfile#134), so a plain install after a
// `git pull` leaves stale copies. This tool removes the deployed copy of each
// `local` entry the Skillfile declares, and only those, then runs
// `skillfile install`. `github` entries stay pinned and are never touched.
//
// Only `install claude-code global` is supported; any other target is refused
// rather than guessed. `--dry-run` prints the planned removals and stops.
// HOME comes from the environment. The exit code is the contract: 1 for a
// refusal, otherwise the exit code of `skillfile install`.
import { existsSync, lstatSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export interface InstallTarget {
	platform: string
	scope: string
}

export interface LocalEntry {
	kind: 'agent' | 'skill'
	name: string
}

export interface Skillfile {
	installs: InstallTarget[]
	locals: LocalEntry[]
}

/** The deployed name of an unnamed entry: an agent's file basename, a skill's directory (or file) name. */
function inferName(kind: 'agent' | 'skill', path: string): string {
	const file = basename(path.replace(/\/+$/, ''))
	if (kind === 'skill' && file === 'SKILL.md') return basename(dirname(path))
	return file.endsWith('.md') ? file.slice(0, -extname(file).length) : file
}

/** Reads `install` and `local` lines; comments, blanks, and every other entry (github, ...) are ignored. */
export function parseSkillfile(text: string): Skillfile {
	const installs: InstallTarget[] = []
	const locals: LocalEntry[] = []
	for (const raw of text.split('\n')) {
		const line = raw.replace(/#.*$/, '').trim()
		if (line === '') continue
		const [command, ...rest] = line.split(/\s+/)
		if (command === 'install' && rest.length >= 2) {
			installs.push({ platform: rest[0], scope: rest[1] })
		} else if (command === 'local' && (rest[0] === 'agent' || rest[0] === 'skill') && rest.length >= 2) {
			const kind = rest[0]
			// `local <kind> <path>` or `local <kind> <name> <path>`
			const name = rest.length >= 3 ? rest[1] : inferName(kind, rest[1])
			locals.push({ kind, name })
		}
	}
	return { installs, locals }
}

/** The problems that make the Skillfile's install targets unsupported; empty when it is `claude-code global` alone. */
export function checkTargets(installs: InstallTarget[]): string[] {
	if (installs.length === 0) return ['the Skillfile declares no `install <platform> <scope>` line; refusing to guess where entries are deployed']
	return installs
		.filter((target) => target.platform !== 'claude-code' || target.scope !== 'global')
		.map((target) => `unsupported install target "${target.platform} ${target.scope}"; only "claude-code global" is supported`)
}

/** The paths to remove for each local entry under `home`; throws if any would sit outside ~/.claude/agents or ~/.claude/skills. */
export function planRemovals(locals: LocalEntry[], home: string): string[] {
	const roots = { agent: join(home, '.claude', 'agents'), skill: join(home, '.claude', 'skills') }
	return locals.map((entry) => {
		if (entry.name === '' || entry.name === '.' || entry.name === '..' || /[\\/]/.test(entry.name) || entry.name.includes('..')) {
			throw new Error(`refusing ${entry.kind} name "${entry.name}": it must be a single path segment`)
		}
		const root = roots[entry.kind]
		const target = resolve(root, entry.kind === 'agent' ? `${entry.name}.md` : entry.name)
		if (dirname(target) !== resolve(root)) throw new Error(`refusing ${entry.kind} "${entry.name}": ${target} is not directly under ${root}`)
		// The parent may be a symlink the user set up on purpose; the target itself must not escape through one.
		if (existsSync(root) && dirname(join(realpathSync(root), basename(target))) !== realpathSync(root)) {
			throw new Error(`refusing ${entry.kind} "${entry.name}": it escapes ${root}`)
		}
		return target
	})
}

export interface Options {
	cwd: string
	home: string
	dryRun: boolean
	skillfileCommand?: string
}

export function main(options: Options): number {
	const path = join(options.cwd, 'Skillfile')
	if (!existsSync(path)) {
		console.error(`no Skillfile in ${options.cwd}`)
		return 1
	}
	const { installs, locals } = parseSkillfile(readFileSync(path, 'utf8'))
	const problems = checkTargets(installs)
	if (problems.length > 0) {
		for (const problem of problems) console.error(problem)
		return 1
	}

	let removals: string[]
	try {
		removals = planRemovals(locals, options.home)
	} catch (error) {
		console.error((error as Error).message)
		return 1
	}

	for (const target of removals) {
		if (options.dryRun) {
			console.log(`would remove ${target}`)
			continue
		}
		// lstat so a dangling symlink is still removed; rmSync unlinks a symlink without following it.
		try {
			lstatSync(target)
		} catch {
			continue
		}
		rmSync(target, { recursive: true, force: true })
		console.log(`removed ${target}`)
	}
	if (options.dryRun) return 0

	const result = spawnSync(options.skillfileCommand ?? 'skillfile', ['install'], { cwd: options.cwd, stdio: 'inherit' })
	if (result.error) {
		console.error(`could not run skillfile: ${result.error.message}`)
		return 1
	}
	return result.status ?? 1
}

const isMain = process.argv[1] !== undefined && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
	const home = process.env.HOME
	if (!home) {
		console.error('HOME is not set')
		process.exit(1)
	}
	process.exit(main({ cwd: process.cwd(), home, dryRun: process.argv.includes('--dry-run') }))
}
