#!/usr/bin/env node
// The frontmatter each loader expects.
//
// - `skills/<name>/SKILL.md` carries exactly `name` and `description`.
// - `agents/<name>.md` carries `name`, `description`, `model`, and `effort`,
//   and may carry only Claude Code's other agent keys (OPTIONAL_AGENT_KEYS).
//   `model` and `effort` hold values the loader accepts.
// - Each entry of an agent's `skills:` names a skill in `skills/`, or an
//   upstream skill the Skillfile declares with `github  skill`.
//
// The exit code is the contract.
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = process.cwd()

export interface FrontmatterEntry {
	key: string
	value: string
	nested: boolean
	items: string[]
}

export type Frontmatter = { entries: FrontmatterEntry[]; error?: undefined } | { entries?: undefined; error: string }

export const SKILL_KEYS = ['name', 'description'] as const
export const AGENT_KEYS = ['name', 'description', 'model', 'effort'] as const
// Claude Code's other agent keys; anything beyond these is refused.
export const OPTIONAL_AGENT_KEYS = ['tools', 'disallowedTools', 'permissionMode', 'maxTurns', 'skills', 'memory', 'isolation', 'background', 'hooks'] as const
export const MODEL = /^(sonnet|opus|haiku|inherit|claude-[a-z0-9.-]+)$/
export const EFFORT = /^(low|medium|high|max|[1-9]\d*)$/

/** A line that opens a block scalar: `key: |`, `- key: >-`, `key: |2+`. */
const BLOCK_SCALAR = /:\s+[|>](?:[1-9][+-]?|[+-][1-9]?)?\s*$/

/** Column of a line's key, past indentation and any `- ` list markers. */
function keyIndent(line: string): number {
	return /^(?:\s*-\s+)*\s*/.exec(line)![0].length
}

/** Reads the leading `---` block as top-level keys, with block-list items kept per key. */
export function parseFrontmatter(text: string): Frontmatter {
	const lines = text.split('\n')
	if (lines[0] !== '---') return { error: 'no YAML frontmatter block — the file must open with a --- line' }

	const end = lines.indexOf('---', 1)
	if (end === -1) return { error: 'the frontmatter block opens with --- but never closes' }

	const entries: FrontmatterEntry[] = []
	// While inside a `|` or `>` block scalar: the indent its lines must exceed.
	let scalarParentIndent: number | undefined
	for (let index = 1; index < end; index += 1) {
		const line = lines[index]

		// A block scalar's content is opaque text: no comments, list items, or keys, and tabs are legal after the indentation.
		if (scalarParentIndent !== undefined) {
			if (line.trim() === '') continue
			const indent = /^ */.exec(line)![0].length
			if (indent > scalarParentIndent) {
				if (line[indent] === '\t') return { error: `line ${index + 1} contains a tab in its indentation; YAML forbids tabs in indentation` }
				continue
			}
			scalarParentIndent = undefined
		}

		if (line.trim() === '' || line.trimStart().startsWith('#')) continue
		if (line.includes('\t')) return { error: `line ${index + 1} contains a tab; YAML forbids tabs in indentation` }

		// An indented line continues the entry above it: a block list item, or a nested map.
		if (/^\s/.test(line)) {
			if (entries.length === 0) return { error: `line ${index + 1} is indented but follows no key` }
			const previous = entries[entries.length - 1]
			const item = /^\s*-\s+(\S.*)$/.exec(line)
			if (item) {
				previous.items.push(item[1].trim())
				previous.value = `${previous.value} ${line.trim()}`.trim()
			} else previous.nested = true
			if (BLOCK_SCALAR.test(line)) scalarParentIndent = keyIndent(line)
			continue
		}

		const separator = line.indexOf(':')
		if (separator === -1) return { error: `line ${index + 1} is not a "key: value" pair: ${line}` }

		entries.push({ key: line.slice(0, separator).trim(), value: line.slice(separator + 1).trim(), nested: false, items: [] })
		if (BLOCK_SCALAR.test(line)) scalarParentIndent = 0
	}

	return { entries }
}

/** Why an unquoted value would not parse as one plain YAML string, if it would not. */
export function plainScalarProblem(value: string): string | undefined {
	if (value === '' || /^["'[{|>]/.test(value)) return undefined
	if (value.includes(': ') || value.endsWith(':')) return 'holds an unquoted ": ", which YAML reads as a nested mapping'
	if (value.includes(' #')) return 'holds an unquoted " #", which YAML reads as the start of a comment'
	if (/^[-?:,\]}#&*!%@`]/.test(value)) return `starts with "${value[0]}", which YAML reserves`
	return undefined
}

/** Skill names a `skills:` entry may use: inline `[a, b]` or a block list. */
function listed(entry: FrontmatterEntry): string[] {
	if (entry.items.length > 0) return entry.items
	const inline = /^\[(.*)\]$/.exec(entry.value)
	return (inline ? inline[1] : entry.value).split(',').map((name) => name.trim()).filter(Boolean)
}

/** Every problem with one skill or agent file's frontmatter. */
export function checkFile(path: string, text: string, known: ReadonlySet<string> = new Set()): string[] {
	const kind = path.startsWith('skills/') && path.endsWith('/SKILL.md') ? 'skill' : path.startsWith('agents/') && path.endsWith('.md') ? 'agent' : undefined
	if (!kind) return []

	const parsed = parseFrontmatter(text)
	if (parsed.error !== undefined) return [`${path}: ${parsed.error}`]
	const { entries } = parsed

	const problems: string[] = []
	const seen = new Set<string>()
	for (const entry of entries) {
		if (seen.has(entry.key)) problems.push(`${path}: "${entry.key}" is declared twice`)
		seen.add(entry.key)
	}

	for (const entry of entries) {
		const problem = entry.items.length === 0 && !entry.nested ? plainScalarProblem(entry.value) : undefined
		if (problem) problems.push(`${path}: "${entry.key}" ${problem} — reword it so it reads as one plain string`)
	}

	const value = (key: string): FrontmatterEntry | undefined => entries.find((entry) => entry.key === key)
	const required: readonly string[] = kind === 'skill' ? SKILL_KEYS : AGENT_KEYS
	for (const key of required) {
		const found = value(key)
		if (!found) problems.push(`${path}: missing "${key}" — a ${kind} carries ${required.map((name) => `"${name}"`).join(', ')}`)
		else if (found.value === '' && !found.nested) problems.push(`${path}: "${key}" is declared but empty`)
	}

	const allowed: readonly string[] = kind === 'skill' ? SKILL_KEYS : [...AGENT_KEYS, ...OPTIONAL_AGENT_KEYS]
	for (const entry of entries) {
		if (!allowed.includes(entry.key)) problems.push(`${path}: "${entry.key}" is not a key a ${kind} carries — use ${allowed.map((name) => `"${name}"`).join(', ')}`)
	}

	if (kind === 'agent') {
		const patterns: Record<string, RegExp> = { model: MODEL, effort: EFFORT }
		for (const [key, pattern] of Object.entries(patterns)) {
			const found = value(key)
			if (found && found.value !== '' && !pattern.test(found.value)) problems.push(`${path}: "${key}: ${found.value}" is not a value its loader accepts (${pattern})`)
		}
		const skills = value('skills')
		if (skills) {
			for (const name of listed(skills)) {
				if (!known.has(name)) problems.push(`${path}: skill "${name}" is neither in skills/ nor declared upstream in the Skillfile`)
			}
		}
	}

	return problems
}

/** Skill names the Skillfile pulls from GitHub: `github  skill  [name]  <owner/repo>  <path>`. */
export function upstreamSkills(skillfile: string): string[] {
	const names: string[] = []
	for (const line of skillfile.split('\n')) {
		const tokens = line.trim().split(/\s+/)
		if (tokens[0] !== 'github' || tokens[1] !== 'skill') continue
		const rest = tokens.slice(2)
		const named = rest.length >= 3 && !rest[0].includes('/') ? rest[0] : undefined
		const path = (named ? rest.slice(2) : rest.slice(1))[0]
		const name = named ?? path?.replace(/\/+$/, '').split('/').pop()
		if (name) names.push(name)
	}
	return names
}

function skillNames(root: string): string[] {
	const directory = join(root, 'skills')
	if (!existsSync(directory)) return []
	return readdirSync(directory).sort().filter((name) => statSync(join(directory, name)).isDirectory())
}

/** The skill and agent files under `root`, relative and sorted. */
export function collectFiles(root: string = ROOT): string[] {
	const agentsDirectory = join(root, 'agents')
	const agents = existsSync(agentsDirectory) ? readdirSync(agentsDirectory).sort().filter((name) => name.endsWith('.md')).map((name) => `agents/${name}`) : []
	const skills = skillNames(root).map((name) => `skills/${name}/SKILL.md`).filter((path) => existsSync(join(root, path)))
	return [...agents, ...skills]
}

export function main(root: string = ROOT): number {
	const skillfilePath = join(root, 'Skillfile')
	const known = new Set([...skillNames(root), ...upstreamSkills(existsSync(skillfilePath) ? readFileSync(skillfilePath, 'utf8') : '')])
	const files = collectFiles(root)
	const problems = files.flatMap((path) => checkFile(path, readFileSync(join(root, path), 'utf8'), known))

	if (problems.length > 0) {
		for (const problem of problems) {
			const [file, ...rest] = problem.split(': ')
			console.error(`::error file=${file}::${rest.join(': ')}`)
		}
		return 1
	}

	console.log(`${files.length} agent and skill file(s) checked: every frontmatter has the shape its loader expects.`)
	return 0
}

const isMain = process.argv[1] !== undefined && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) process.exit(main())
