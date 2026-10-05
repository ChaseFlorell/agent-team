#!/usr/bin/env node
// Every agent and skill here names nothing specific to one project and cites
// no record: no product, domain, repository path, or decision, lesson,
// convention, or claim number. A project's specifics belong in its own
// companion skill, which names the generic skill it extends.
//
// The files checked: every `.md` under `agents/`, at any depth, and every text
// file under each `skills/<name>/`. A skill directory without an exact
// `SKILL.md` fails, so a misnamed file cannot hide a skill on a
// case-insensitive disk.
//
// FORBIDDEN lists the terms of the projects this team works in; add a
// project's terms when the team joins it.
//
// Accepted false positives: a file may not use "reporter" except as "test
// reporter", nor "occurrence report"; reword it.
//
// The exit code is the contract.
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = process.cwd()

const TEXT = /\.(md|ya?ml|json|txt)$/i

/** Every file under `directory`, recursively, relative to `root`, sorted. */
function walk(root: string, directory: string): string[] {
	const full = join(root, directory)
	if (!existsSync(full)) return []
	return readdirSync(full)
		.sort()
		.flatMap((name) => {
			const path = join(full, name)
			return statSync(path).isDirectory() ? walk(root, join(directory, name)) : [relative(root, path).split('\\').join('/')]
		})
}

/** The skill directories under `root`. */
function skills(root: string): string[] {
	const directory = join(root, 'skills')
	if (!existsSync(directory)) return []
	return readdirSync(directory)
		.sort()
		.filter((name) => statSync(join(directory, name)).isDirectory())
}

/** Every instruction file under `root`: each agent, and each text file of each skill. */
export function instructionFiles(root: string = ROOT): string[] {
	const agents = walk(root, 'agents').filter((path) => /\.md$/i.test(path))
	return [...agents, ...skills(root).flatMap((name) => walk(root, `skills/${name}`).filter((path) => TEXT.test(path)))]
}

/** Each skill directory with no file named exactly `SKILL.md`. */
export function missingSkillFiles(root: string = ROOT): string[] {
	return skills(root)
		.filter((name) => !readdirSync(join(root, 'skills', name)).includes('SKILL.md'))
		.map((name) => `skills/${name}/SKILL.md`)
}

// A pattern carries its own flags; most are case-insensitive. `why` is what
// the author sees.
export interface Forbidden {
	pattern: RegExp
	why: string
}

export const FORBIDDEN: readonly Forbidden[] = [
	{ pattern: /hpac/i, why: 'names a product' },
	{ pattern: /acvl/i, why: 'names a product' },
	{ pattern: /safety-report/i, why: 'names a repository' },
	{ pattern: /aviation|occurrence report|\bpilot|pilote/i, why: 'names a product domain' },
	{ pattern: /safety ?officer|(?<!test )\breporter/i, why: 'names a product role' },
	{ pattern: /typeform|gemini|graphify|reqnroll/i, why: 'names a tool or provider one project chose' },
	{ pattern: /\bADR-\d/i, why: 'cites a decision record by number' },
	{ pattern: /\blesson \d/i, why: 'cites a lesson by number' },
	{ pattern: /\b(REQ|CON)-[A-Z]+-\d/, why: 'cites a claim by ID' },
	{ pattern: /CONV-\d/, why: 'cites a convention by number' },
	// Case-sensitive: "the Worker" is one product's background service, and "the worker" is a plain noun.
	{ pattern: /\b[Tt]he Worker\b/, why: 'names a product\'s background service' },
	{ pattern: /\.spec\/|docs\/(decisions|lessons)\/|\btools\/[\w/-]+\.|\bsrc\/(web|HpacSafety)/i, why: 'names a path in one repository' },
]

// An instruction file names a topic, never the record that holds it. A
// separator is any run of whitespace, ASCII or Unicode hyphens, or "#", so
// "ADR 0147", "ADR0147", and "ADR\u20110147" all count; a reference may wrap
// onto the next line. A lesson or convention needs a 3-4 digit number, so
// "lesson 2 days old" and "lessons 2 and 3" stay prose.
const DASH = '\\-\\u2010-\\u2015'
const SEP = `[\\s${DASH}#]*`
const HYPHEN = `[${DASH}]\\s*`
export const RECORD_REFERENCES: readonly Forbidden[] = [
	// ".spec" with or without a slash, but not a test file: foo.spec.ts, .tsx, .js, .mjs, .cjs, .jsx.
	{ pattern: /\.spec\b(?!\.[cm]?[jt]sx?\b)|(?<![\w/-])(traceability\.md|claims(\.schema)?\.json|area-paths\.json)\b/i, why: 'references a specification path' },
	{ pattern: new RegExp(`\\bADR${SEP}\\d{3,4}`, 'i'), why: 'references a decision record by number' },
	{ pattern: new RegExp(`\\bCONV${SEP}\\d{3}`, 'i'), why: 'references a convention by number' },
	{ pattern: new RegExp(`\\b(REQ|CON)${HYPHEN}[A-Z]+${HYPHEN}\\d{2,}`, 'i'), why: 'references a claim by ID' },
	{ pattern: new RegExp(`\\blessons?(${SEP}\\d{3,4}\\b|\\s*[#${DASH}]\\s*\\d+|/\\d)`, 'i'), why: 'references a lesson by number' },
	{ pattern: /docs\/(decisions|lessons)\//i, why: 'references a record directory' },
]

const squash = (text: string): string => text.replace(/\s+/g, ' ')

/** Every term one file's text may not hold, as `path:line: why (match)`. */
export function checkText(path: string, text: string): string[] {
	const problems: string[] = []
	const lines = text.split('\n')
	lines.forEach((line, index) => {
		const reported = new Set<string>()
		for (const { pattern, why } of FORBIDDEN) {
			const match = pattern.exec(line)
			if (match) {
				reported.add(squash(match[0]).toLowerCase())
				problems.push(`${path}:${index + 1}: ${why} ("${match[0]}")`)
			}
		}
		// The line joined with the next, so a reference wrapped across a line break is
		// caught; it counts only where it starts, so the next line does not report it again.
		const joined = index + 1 < lines.length ? `${line}\n${lines[index + 1]}` : line
		for (const { pattern, why } of RECORD_REFERENCES) {
			const match = pattern.exec(joined)
			if (!match || match.index >= line.length) continue
			const text = squash(match[0])
			const lower = text.toLowerCase()
			// FORBIDDEN matches a shorter prefix ("ADR-0"), so overlap counts as the same match.
			if (![...reported].some((seen) => lower.includes(seen) || seen.includes(lower))) problems.push(`${path}:${index + 1}: ${why} ("${text}")`)
		}
	})
	return problems
}

export function main(root: string = ROOT, files: readonly string[] = instructionFiles(root)): number {
	const problems: string[] = missingSkillFiles(root).map((path) => `${path}:1: a skill directory needs a file named exactly SKILL.md`)
	for (const path of files) problems.push(...checkText(path, readFileSync(join(root, path), 'utf8')))

	if (problems.length > 0) {
		for (const problem of problems) {
			const [file, line, ...rest] = problem.split(':')
			console.error(`::error file=${file},line=${line}::${rest.join(':').trim()}`)
		}
		return 1
	}

	console.log(`${files.length} instruction file(s) checked: none names a project or references a record.`)
	return 0
}

const isMain = process.argv[1] !== undefined && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) process.exit(main())
