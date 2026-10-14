#!/usr/bin/env node
// Redeploy every `local` entry of the Skillfile.
//
// `skillfile install` never overwrites a local agent or skill already present
// in ~/.claude (upstream eljulians/skillfile#134), so a plain install after a
// `git pull` leaves stale copies. This tool MOVES the deployed copy of each
// `local` entry the Skillfile declares, and only those, into
// ~/.claude/.refresh-install-backup/<ISO timestamp>/{agents,skills}/<name>,
// then runs `skillfile install`. Nothing is deleted, so a same-name user skill
// or a case-insensitive collision is recoverable. `github` entries stay pinned
// and are never touched.
//
// Transactional: `skillfile --version` must resolve before anything moves; a
// failed move moves back what was already moved; a failed install restores
// every moved copy whose destination is still missing (it never overwrites
// anything install deployed). On success the backup is left in place.
//
// Only `install claude-code global` is supported; any other target is refused
// rather than guessed. `--dry-run` prints the planned moves and stops.
// HOME comes from the environment and must be absolute. The exit code is the
// contract: 1 for a refusal or rolled-back move, otherwise the exit code of
// `skillfile install`.
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync } from 'node:fs'
import { basename, dirname, extname, isAbsolute, join } from 'node:path'
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

export interface Move {
	kind: 'agent' | 'skill'
	target: string
}

/** The deployed name of an unnamed entry: an agent's file basename, a skill's directory (or file) name. */
function inferName(kind: 'agent' | 'skill', path: string): string {
	const trimmed = path.replace(/\/+$/, '')
	const file = basename(trimmed)
	if (kind === 'skill' && file === 'SKILL.md') return basename(dirname(trimmed))
	return file.endsWith('.md') ? file.slice(0, -extname(file).length) : file
}

/**
 * Reads `install` and `local` lines; comments, blanks, and every other entry (github, ...) are ignored.
 * A comment starts at `#` at the line start or after whitespace, like skillfile. Quotes are not parsed, so a line with one is refused.
 */
export function parseSkillfile(text: string): Skillfile {
	const installs: InstallTarget[] = []
	const locals: LocalEntry[] = []
	for (const raw of text.split('\n')) {
		const line = raw.replace(/(^|\s)#.*$/, '').trim()
		if (line === '') continue
		if (/["']/.test(line)) throw new Error(`refusing Skillfile line with a quote (quotes are not parsed): ${line}`)
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

/**
 * The deployed path for each local entry under `home`. Throws if a name has a separator, or if the target's
 * parent directory does not resolve to ~/.claude/agents or ~/.claude/skills. The target itself is never
 * resolved: a symlink there is moved as a link, never followed.
 */
export function planMoves(locals: LocalEntry[], home: string): Move[] {
	const roots = { agent: join(home, '.claude', 'agents'), skill: join(home, '.claude', 'skills') }
	return locals.map((entry) => {
		if (entry.name === '' || entry.name === '.' || entry.name === '..' || /[\\/]/.test(entry.name) || entry.name.includes('..')) {
			throw new Error(`refusing ${entry.kind} name "${entry.name}": it must be a single path segment`)
		}
		const root = roots[entry.kind]
		const target = join(root, entry.kind === 'agent' ? `${entry.name}.md` : entry.name)
		if (existsSync(root) && realpathSync(dirname(target)) !== realpathSync(root)) {
			throw new Error(`refusing ${entry.kind} "${entry.name}": its parent directory is not ${root}`)
		}
		return { kind: entry.kind, target }
	})
}

export interface Options {
	cwd: string
	home: string
	dryRun: boolean
	skillfileCommand?: string
	/** Test seam: the move primitive. */
	rename?: (from: string, to: string) => void
}

function present(path: string): boolean {
	// lstat so a dangling symlink counts as present.
	try {
		lstatSync(path)
		return true
	} catch {
		return false
	}
}

interface Moved {
	from: string
	to: string
}

export function main(options: Options): number {
	if (!isAbsolute(options.home)) {
		console.error(`HOME must be an absolute path, got "${options.home}"`)
		return 1
	}
	const skillfilePath = join(options.cwd, 'Skillfile')
	if (!existsSync(skillfilePath)) {
		console.error(`no Skillfile in ${options.cwd}`)
		return 1
	}

	let plan: Move[]
	try {
		const { installs, locals } = parseSkillfile(readFileSync(skillfilePath, 'utf8'))
		const problems = checkTargets(installs)
		if (problems.length > 0) {
			for (const problem of problems) console.error(problem)
			return 1
		}
		plan = planMoves(locals, options.home)
	} catch (error) {
		console.error((error as Error).message)
		return 1
	}

	if (options.dryRun) {
		for (const { target } of plan) console.log(`would move ${target}`)
		return 0
	}

	const command = options.skillfileCommand ?? 'skillfile'
	const probe = spawnSync(command, ['--version'], { cwd: options.cwd, stdio: 'ignore' })
	if (probe.error || probe.status !== 0) {
		console.error(`could not run \`${command} --version\`${probe.error ? `: ${probe.error.message}` : ` (exit ${probe.status})`}; nothing was moved`)
		return 1
	}

	const rename = options.rename ?? renameSync
	const backup = join(options.home, '.claude', '.refresh-install-backup', new Date().toISOString())
	const moved: Moved[] = []
	const restore = (): string[] => {
		const restored: string[] = []
		for (const { from, to } of [...moved].reverse()) {
			// Never overwrite what install deployed.
			if (present(from)) continue
			try {
				rename(to, from)
				restored.push(from)
			} catch (error) {
				console.error(`could not restore ${from} from ${to}: ${(error as Error).message}`)
			}
		}
		return restored
	}

	for (const { kind, target } of plan) {
		if (!present(target)) continue
		const destination = join(backup, kind === 'agent' ? 'agents' : 'skills', basename(target))
		try {
			mkdirSync(dirname(destination), { recursive: true })
			rename(target, destination)
		} catch (error) {
			console.error(`could not move ${target}: ${(error as Error).message}`)
			const restored = restore()
			console.error(`rolled back ${restored.length} moved ${restored.length === 1 ? 'copy' : 'copies'}; backup folder: ${backup}`)
			return 1
		}
		moved.push({ from: target, to: destination })
		console.log(`moved ${target}`)
	}

	const result = spawnSync(command, ['install'], { cwd: options.cwd, stdio: 'inherit' })
	const code = result.error ? 1 : (result.status ?? 1)
	if (result.error) console.error(`could not run skillfile: ${result.error.message}`)
	if (code !== 0) {
		const restored = restore()
		for (const path of restored) console.error(`restored ${path}`)
		console.error(`skillfile install failed (exit ${code}); restored ${restored.length} of ${moved.length}; backup folder: ${backup}`)
		return code
	}
	if (moved.length > 0) console.log(`previous copies kept in ${backup}`)
	return 0
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
