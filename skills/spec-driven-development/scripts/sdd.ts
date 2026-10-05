#!/usr/bin/env node
// The generator and checker behind the spec-driven-development skill.
//
// One specification directory (default `.spec`) holds every file the chain
// reads: feature areas, constraint pages, the glossary, decisions,
// conventions, lessons, and three generated files. This script creates each
// from the templates beside it, numbers it after a scan of every remote
// branch, generates the index and the traceability matrix, and checks every
// structural rule the skill states. Dependency-free; the exit code is the
// contract.
//
//   node sdd.ts init --project "<Name>" [--deciders "<names>"]
//   node sdd.ts new feature <area> --prefix <AREA> --title "<Title>"
//   node sdd.ts new page <slug> --prefix <PAGE> --title "<Title>"
//   node sdd.ts new adr "<title>" [--deciders "<names>"]
//   node sdd.ts new convention "<title>"
//   node sdd.ts new lesson "<title>" --issue <N> --kind product|process|incident
//   node sdd.ts next-claim <area>
//   node sdd.ts next-adr
//   node sdd.ts generate [--check]
//   node sdd.ts check
//   node sdd.ts coverage --base <ref> [--body <file>]
//
// Every command takes `--root <dir>` (default `.spec`), relative to the
// working directory, which is the repository root.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, posix, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const TEMPLATES = join(dirname(fileURLToPath(import.meta.url)), '..', 'templates')

export const DEFAULT_ROOT = '.spec'
export const GENERATED = ['README.md', 'traceability.md', 'claims.json'] as const
export const TYPES = ['spec', 'guide', 'readme', 'adr', 'lesson', 'convention', 'template'] as const
export const ADR_STATUSES = ['proposed', 'accepted', 'rejected', 'deprecated', 'superseded'] as const
export const ADR_SECTIONS = ['Context', 'Decision drivers', 'Considered options', 'Decision', 'Consequences', 'Related'] as const
export const REQUIRED_ADR_SECTIONS = ['Context', 'Considered options', 'Decision', 'Consequences'] as const
export const LESSON_SECTIONS = ['Symptom', 'Root cause', 'Spec delta', 'Scenario', 'Skill'] as const
export const LESSON_KINDS = ['product', 'process', 'incident'] as const
export const CONVENTION_SECTIONS = ['Rule', 'Why', 'Enforced by'] as const
export const RECORD_STATUSES = ['accepted', 'superseded'] as const

/** Why a scenario might genuinely be unnecessary. Closed: a new category is argued for, not typed. */
export const CATEGORIES: Readonly<Record<string, string>> = {
	refactor: 'behaviour is unchanged; the code that produces it moved',
	styling: 'appearance only, with no change to what the page does',
	dependency: 'a package or lock version moved',
	'test-only': 'tests changed and no production code did',
	build: 'build, packaging, or tooling configuration',
	revert: 'an earlier change is being undone',
	docs: 'documentation only',
}

// Keys a `type` adds on top of title, description, and type.
const EXTRA_KEYS: Readonly<Record<string, readonly string[]>> = {
	spec: ['area'],
	adr: ['status', 'date', 'decision-makers', 'keywords'],
	convention: ['status', 'date'],
	lesson: ['date', 'issue', 'status', 'kind'],
}

const CLAIM = /^REQ-[A-Z]+-\d{3}$/
const CLAIM_ANY = /\bREQ-[A-Z]+-\d{3}\b/g
const CONSTRAINT = /^CON-[A-Z]+-\d{3}$/
const CONSTRAINT_ANY = /\bCON-[A-Z]+-\d{3}\b/g
const ADR_ANY = /\bADR-\d{4}\b/g
const CONV_ANY = /\bCONV-\d{3}\b/g
const ADR_FILE = /^ADR-(\d{4})-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/
const CONV_FILE = /^CONV-(\d{3})-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/
const LESSON_FILE = /^(\d{4})-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const PREFIX = /^REQ-[A-Z]+$/
const CODE = /^[A-Z]+$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const PLACEHOLDER = /<[A-Za-z][^<>\n]{2,}>/
const DIAGRAM_FENCE = /^\s*(?:```+|~~~+)\s*(plantuml|dot|graphviz|ascii|diagram)\b/i
const EXEMPTION = /^No `?\.feature`? scenario needed:\s*([a-z-]+)\s*[—-]\s*(.+)$/im
const ATTEMPTED = /^No `?\.feature`? scenario needed:/im
const PRESERVED = /^Claims preserved:\s*(.+)$/im

/** Words that drive a browser rather than describe what the actor does or sees. */
const MECHANICS =
	/\b(?:click(?:s|ed|ing)?|tap(?:s|ped|ping)?|hover(?:s|ed|ing)?|scroll(?:s|ed|ing)?|drag(?:s|ged|ging)?|press(?:es|ed|ing)?|keystrokes?|types? into|selectors?|css|dom|viewport|pixels?|combobox|textbox|button role)\b|\b(?:data|aria)-[a-z][a-z0-9-]*(?:=|["'])/i

/** Words that name the implementation rather than the behaviour. */
const TRANSPORT: readonly { pattern: RegExp; why: string }[] = [
	{ pattern: /\b(?:HTTP|GET|POST|PUT|PATCH|DELETE|JSON|API|DTO|SQL)\b/, why: 'a transport or implementation term' },
	{ pattern: /\bendpoints?\b/i, why: 'an endpoint' },
	// A status code only in a status context: "at most 200 characters" is a count.
	{ pattern: /\b(?:status|code|HTTP|returns|responds(?: with)?)\s+[1-5]\d\d\b/i, why: 'a status code' },
	{ pattern: /\b[a-z0-9]+(?:_[a-z0-9]+)+\b/, why: 'a snake_case identifier' },
	// Three humps, or two with a digit; a two-hump product name ("GitHub") passes, and any name may be quoted.
	{ pattern: /\b[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+){2,}\b|\b(?=[A-Za-z]*\d)[A-Z][a-z0-9]+[A-Z][a-z0-9]+\b/, why: 'a PascalCase identifier' },
]

// ---------------------------------------------------------------------------
// Results and problems

export interface Problem {
	file: string
	line?: number
	message: string
}

export interface Result {
	code: number
	output: string[]
	errors: string[]
}

export interface Context {
	cwd: string
	root: string
}

const ok = (...output: string[]): Result => ({ code: 0, output, errors: [] })
const fail = (...errors: string[]): Result => ({ code: 1, output: [], errors })

/** The root as the user wrote it, in posix form, for display. */
const rootName = (ctx: Context): string => posix.normalize(ctx.root.split('\\').join('/')).replace(/\/+$/, '') || '.'
const rootPath = (ctx: Context): string => resolve(ctx.cwd, ctx.root)
const display = (ctx: Context, rel: string): string => posix.join(rootName(ctx), rel.split('\\').join('/'))

const problemLine = ({ file, line, message }: Problem): string => `::error file=${file}${line === undefined ? '' : `,line=${line}`}::${message}`

function sortProblems(problems: Problem[]): Problem[] {
	return problems.sort((a, b) => compare(a.file, b.file) || (a.line ?? 0) - (b.line ?? 0) || compare(a.message, b.message))
}

/** Code-point order, the same on every machine; localeCompare is not. */
export const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)
const unique = (values: readonly string[]): string[] => [...new Set(values)].sort(compare)
const matches = (text: string, pattern: RegExp): string[] => unique(text.match(pattern) ?? [])
const pad = (value: number, width: number): string => String(value).padStart(width, '0')

// ---------------------------------------------------------------------------
// Frontmatter and markdown

export interface Frontmatter {
	data: Record<string, string>
	/** The line index of the closing `---`, or -1. */
	end: number
	error?: string
}

const unquote = (value: string): string => value.replace(/^(["'])(.*)\1$/, '$2')

/** Reads the leading `---` block as flat keys; an indented line continues the key above it. */
export function parseFrontmatter(text: string): Frontmatter {
	const lines = text.split('\n')
	if (lines[0] !== '---') return { data: {}, end: -1, error: 'no YAML frontmatter block — the file must open with a --- line' }
	const end = lines.indexOf('---', 1)
	if (end === -1) return { data: {}, end: -1, error: 'the frontmatter block opens with --- but never closes' }
	const data: Record<string, string> = {}
	let last: string | undefined
	for (let index = 1; index < end; index += 1) {
		const line = lines[index]
		if (line.trim() === '' || line.trimStart().startsWith('#')) continue
		if (/^\s/.test(line)) {
			if (last !== undefined) data[last] = `${data[last]} ${line.trim().replace(/^-\s+/, '')}`.trim()
			continue
		}
		const separator = line.indexOf(':')
		if (separator === -1) return { data, end, error: `line ${index + 1} is not a "key: value" pair: ${line}` }
		last = line.slice(0, separator).trim()
		data[last] = unquote(line.slice(separator + 1).trim())
	}
	return { data, end }
}

export interface Heading {
	level: number
	text: string
	line: number
}

/** The lines of `text` with every fenced code block blanked, so line numbers survive. */
export function unfenced(text: string): string[] {
	let fence: string | undefined
	return text.split('\n').map((line) => {
		const mark = /^\s*(```+|~~~+)/.exec(line)
		if (fence === undefined) {
			if (mark) {
				fence = mark[1]
				return ''
			}
			return line
		}
		if (mark && mark[1][0] === fence[0] && mark[1].length >= fence.length) fence = undefined
		return ''
	})
}

export function headings(text: string): Heading[] {
	const found: Heading[] = []
	unfenced(text).forEach((line, index) => {
		const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line)
		if (match) found.push({ level: match[1].length, text: match[2], line: index + 1 })
	})
	return found
}

/** GitHub's heading anchor: lower case, punctuation dropped, each space a hyphen. */
export const anchor = (heading: string): string =>
	heading
		.toLowerCase()
		.replace(/`/g, '')
		.replace(/[^\p{L}\p{N}\s_-]/gu, '')
		.trim()
		.replace(/ /g, '-')

/** Every heading's anchor, a repeated heading taking `-1`, `-2`, … as GitHub does. */
export function anchors(text: string): Set<string> {
	const seen = new Map<string, number>()
	const found = new Set<string>()
	for (const heading of headings(text)) {
		const base = anchor(heading.text)
		const count = seen.get(base) ?? 0
		seen.set(base, count + 1)
		found.add(count === 0 ? base : `${base}-${count}`)
	}
	return found
}

/** The body of `## heading`, up to the next `##` or the end. */
export function section(text: string, heading: string): string {
	const lines = text.split('\n')
	const all = headings(text).filter((entry) => entry.level === 2)
	const start = all.findIndex((entry) => entry.text === heading)
	if (start === -1) return ''
	const from = all[start].line
	const to = start + 1 < all.length ? all[start + 1].line - 1 : lines.length
	return lines.slice(from, to).join('\n')
}

/** Text with its quoted strings, code spans, and placeholders removed. */
const bare = (text: string): string => text.replace(/"[^"]*"/g, ' ').replace(/`[^`]*`/g, ' ').replace(/<[^<>]*>/g, ' ')

/** A markdown line as prose: no code span, link target, quote, or placeholder. */
const prose = (line: string): string => bare(line.replace(/\]\([^)]*\)/g, '] '))

const cell = (text = ''): string => text.replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim()
const splitRow = (line: string): string[] =>
	line
		.trim()
		.replace(/^\|/, '')
		.replace(/\|$/, '')
		.split(/(?<!\\)\|/)
		.map((value) => value.trim().replace(/\\\|/g, '|'))

// ---------------------------------------------------------------------------
// Gherkin

export interface Step {
	keyword: 'Given' | 'When' | 'Then'
	text: string
	line: number
}

export interface ExampleRow {
	/** The header cells of this row's Examples block: the column each cell is read through. */
	headers: string[]
	cells: string[]
	line: number
}

export interface Scenario {
	keyword: 'Scenario' | 'Scenario Outline'
	name: string
	line: number
	tags: string[]
	steps: Step[]
	examples: ExampleRow[]
	rule: string | null
}

export interface FeatureFile {
	title: string
	line: number
	/** Tags on the Feature line, which every scenario inherits. */
	tags: string[]
	background: Step[]
	scenarios: Scenario[]
	/** A step keyword with no text after it. */
	malformed: { line: number; text: string }[]
}

const KEYWORD = /^(Feature|Background|Rule|Scenario Outline|Scenario Template|Scenario|Example|Examples|Scenarios):\s*(.*)$/
const STEP = /^(Given|When|Then|And|But|\*)(?:\s+(.*))?$/

/** A line-based read of a `.feature` file: enough for its shape, tags, steps, and Examples cells. */
export function parseFeature(text: string): FeatureFile {
	const feature: FeatureFile = { title: '', line: 0, tags: [], background: [], scenarios: [], malformed: [] }
	let tags: string[] = []
	let mode: 'none' | 'background' | 'scenario' | 'examples' = 'none'
	let current: Scenario | undefined
	let last: Step['keyword'] = 'Given'
	let docString: string | undefined
	let headers: string[] | null = null
	let rule: string | null = null
	text.replace(/\r\n?/g, '\n').split('\n').forEach((raw, index) => {
		const line = raw.trim()
		const number = index + 1
		if (docString !== undefined) {
			if (line.startsWith(docString)) docString = undefined
			return
		}
		if (line === '' || line.startsWith('#')) return
		if (line.startsWith('"""') || line.startsWith('```')) {
			docString = line.slice(0, 3)
			return
		}
		if (line.startsWith('@')) {
			for (const token of line.split(/\s+/)) {
				if (token.startsWith('#')) break
				if (token.startsWith('@')) tags.push(token)
			}
			return
		}
		const keyword = KEYWORD.exec(line)
		if (keyword) {
			const [, kind, name] = keyword
			if (kind === 'Feature') {
				feature.title = name
				feature.line = number
				feature.tags = tags
				mode = 'none'
			} else if (kind === 'Background') {
				mode = 'background'
				last = 'Given'
			} else if (kind === 'Rule') {
				rule = name
				mode = 'none'
			} else if (kind === 'Examples' || kind === 'Scenarios') {
				mode = 'examples'
				headers = null
			} else {
				current = {
					keyword: kind === 'Scenario Outline' || kind === 'Scenario Template' ? 'Scenario Outline' : 'Scenario',
					name,
					line: number,
					tags: [...new Set([...feature.tags, ...tags])],
					steps: [],
					examples: [],
					rule,
				}
				feature.scenarios.push(current)
				mode = 'scenario'
				last = 'Given'
			}
			tags = []
			return
		}
		if (line.startsWith('|')) {
			if (mode === 'examples' && current) {
				if (headers === null) headers = splitRow(line)
				else current.examples.push({ headers, cells: splitRow(line), line: number })
			}
			return
		}
		const step = STEP.exec(line)
		if (step && (mode === 'background' || mode === 'scenario')) {
			const [, word, body] = step
			if (word === 'Given' || word === 'When' || word === 'Then') last = word
			if (!body || body.trim() === '') {
				feature.malformed.push({ line: number, text: line })
				return
			}
			const entry: Step = { keyword: last, text: body.trim(), line: number }
			if (mode === 'background') feature.background.push(entry)
			else current?.steps.push(entry)
		}
	})
	return feature
}

// ---------------------------------------------------------------------------
// The specification as read from the tree

export interface MarkdownFile {
	/** Relative to the root, posix. */
	rel: string
	/** For messages: the root as given plus `rel`. */
	file: string
	abs: string
	text: string
	frontmatter: Frontmatter
}

export interface Area {
	name: string
	readme: MarkdownFile | null
	featureFile: string | null
	featureText: string | null
	feature: FeatureFile | null
	prefix: string | undefined
	/** Foreign prefixes its claims keep: live ones from another area, retired ones with their last number. */
	keeps: { prefix: string; last: number | undefined; raw: string }[]
	title: string
	description: string
}

export interface Claim {
	id: string
	area: string
	file: string
	line: number
	title: string
	rule: string | null
	tags: string[]
	engine: 'application' | 'browser'
	status: 'Planned' | 'Built'
	steps: Step[]
}

export interface Constraint {
	id: string
	page: string
	line: number
	verifiedBy: string[]
	note: string
}

export interface ConstraintPage {
	markdown: MarkdownFile
	code: string | null
	constraints: Constraint[]
	/** A malformed ID: `generate` refuses these too. */
	idProblems: Problem[]
	/** A constraint that names nothing it is verified by. */
	problems: Problem[]
}

export interface SpecRecord {
	markdown: MarkdownFile
	number: number
	id: string
	title: string
	status: string
	date: string
	heading: Heading | null
	statusLine: { text: string; line: number } | null
	sections: Heading[]
}

export interface Lesson extends SpecRecord {
	kind: string
	issue: string
	skills: string[]
}

export interface AreaPaths {
	every: string[]
	areas: Record<string, string[]>
}

export interface Spec {
	ctx: Context
	name: string
	path: string
	markdown: MarkdownFile[]
	areas: Area[]
	claims: Claim[]
	pages: ConstraintPage[]
	constraints: Constraint[]
	decisions: SpecRecord[]
	conventions: SpecRecord[]
	lessons: Lesson[]
	glossary: MarkdownFile | null
	areaPaths: AreaPaths | null
	areaPathsError: string | undefined
}

const isDirectory = (path: string): boolean => existsSync(path) && statSync(path).isDirectory()
const isFile = (path: string): boolean => existsSync(path) && statSync(path).isFile()
const listDirectory = (path: string): string[] => (isDirectory(path) ? readdirSync(path).sort() : [])

function walkMarkdown(root: string, directory = ''): string[] {
	return listDirectory(join(root, directory)).flatMap((name) => {
		const rel = directory ? posix.join(directory, name) : name
		if (isDirectory(join(root, rel))) return walkMarkdown(root, rel)
		return name.endsWith('.md') ? [rel] : []
	})
}

function readMarkdown(ctx: Context, rel: string): MarkdownFile {
	const abs = join(rootPath(ctx), rel)
	const text = readFileSync(abs, 'utf8').replace(/\r\n?/g, '\n')
	return { rel, file: display(ctx, rel), abs, text, frontmatter: parseFrontmatter(text) }
}

function parseKeeps(value: string | undefined): Area['keeps'] {
	if (!value) return []
	return value
		.split(/[,\s]+/)
		.filter(Boolean)
		.map((raw) => {
			const match = /^([^=]+)(?:=(\d+))?$/.exec(raw)
			return { prefix: match ? match[1] : raw, last: match?.[2] === undefined ? undefined : Number(match[2]), raw }
		})
}

function parseRecord(markdown: MarkdownFile, number: number, id: string): SpecRecord {
	const all = headings(markdown.text)
	const heading = all.find((entry) => entry.level === 1) ?? null
	const lines = markdown.text.split('\n')
	let statusLine: SpecRecord['statusLine'] = null
	if (heading) {
		let index = heading.line
		while (index < lines.length && lines[index].trim() === '') index += 1
		if (index < lines.length && lines[index].trimStart().startsWith('**Status:**')) {
			const start = index
			const paragraph: string[] = []
			while (index < lines.length && lines[index].trim() !== '') paragraph.push(lines[index].trim()), (index += 1)
			statusLine = { text: paragraph.join(' '), line: start + 1 }
		}
	}
	const { data } = markdown.frontmatter
	return {
		markdown,
		number,
		id,
		title: data.title ?? '',
		status: data.status ?? '',
		date: data.date ?? '',
		heading,
		statusLine,
		sections: all.filter((entry) => entry.level === 2),
	}
}

function parseConstraints(markdown: MarkdownFile): { constraints: Constraint[]; idProblems: Problem[]; problems: Problem[] } {
	const constraints: Constraint[] = []
	const idProblems: Problem[] = []
	const problems: Problem[] = []
	const lines = unfenced(markdown.text)
	lines.forEach((line, index) => {
		const bullet = /^\s*-\s+\*\*(CON-[A-Za-z0-9-]+)\*\*\s*(.*)$/.exec(line)
		if (!bullet) {
			if (/\*\*CON-/.test(line)) idProblems.push({ file: markdown.file, line: index + 1, message: 'a constraint is a bullet: `- **CON-<PAGE>-NNN** <rule> *Verified by: …*`' })
			return
		}
		const id = bullet[1]
		if (!CONSTRAINT.test(id)) idProblems.push({ file: markdown.file, line: index + 1, message: `"${id}" is not of the form CON-<PAGE>-NNN` })
		const block = [bullet[2]]
		let next = index + 1
		while (next < lines.length && lines[next].trim() !== '' && !/^-\s/.test(lines[next]) && !/^#/.test(lines[next])) block.push(lines[next].trim()), (next += 1)
		const joined = block.join(' ')
		const verified = /\*Verified by:\s*([^*]*)\*/i.exec(joined)
		if (!verified) {
			problems.push({ file: markdown.file, line: index + 1, message: `${id} has no *Verified by:* line — name the claims that verify it, or "none — <why>"` })
		} else if (!/^none\b/i.test(verified[1].trim()) && matches(verified[1], CLAIM_ANY).length === 0 && matches(verified[1], CONSTRAINT_ANY).length === 0) {
			problems.push({ file: markdown.file, line: index + 1, message: `${id} names no claim under *Verified by:* and does not say "none — <why>"` })
		}
		const verifiedBy = verified ? matches(verified[1], CLAIM_ANY) : []
		constraints.push({ id, page: markdown.rel, line: index + 1, verifiedBy, note: joined.slice(0, verified?.index ?? joined.length).trim() })
	})
	return { constraints, idProblems, problems }
}

/** Everything under the root, read leniently; `checkProblems` judges it. */
export function readSpec(ctx: Context): Spec {
	const path = rootPath(ctx)
	const markdown = walkMarkdown(path).map((rel) => readMarkdown(ctx, rel))
	const byRel = new Map(markdown.map((file) => [file.rel, file]))

	const areas: Area[] = listDirectory(join(path, 'features'))
		.filter((name) => isDirectory(join(path, 'features', name)))
		.map((name) => {
			const readme = byRel.get(`features/${name}/README.md`) ?? null
			const featureRel = `features/${name}/${name}.feature`
			const featureText = isFile(join(path, featureRel)) ? readFileSync(join(path, featureRel), 'utf8').replace(/\r\n?/g, '\n') : null
			const data = readme?.frontmatter.data ?? {}
			return {
				name,
				readme,
				featureFile: featureText === null ? null : display(ctx, featureRel),
				featureText,
				feature: featureText === null ? null : parseFeature(featureText),
				prefix: data.prefix || undefined,
				keeps: parseKeeps(data.keeps),
				title: data.title ?? name,
				description: data.description ?? '',
			}
		})

	const claims: Claim[] = []
	for (const area of areas) {
		if (!area.feature || !area.featureFile) continue
		for (const scenario of area.feature.scenarios) {
			const ids = scenario.tags.filter((tag) => CLAIM.test(tag.slice(1)))
			if (ids.length !== 1) continue
			claims.push({
				id: ids[0].slice(1),
				area: area.name,
				file: area.featureFile,
				line: scenario.line,
				title: scenario.name,
				rule: scenario.rule,
				tags: scenario.tags,
				engine: scenario.tags.includes('@ui') ? 'browser' : 'application',
				status: scenario.tags.includes('@ignore') ? 'Planned' : 'Built',
				steps: scenario.steps,
			})
		}
	}

	const pages: ConstraintPage[] = markdown
		.filter((file) => !file.rel.includes('/') && !GENERATED.includes(file.rel as (typeof GENERATED)[number]) && /^\s*-\s+\*\*CON-/m.test(file.text))
		.map((file) => {
			const { constraints, idProblems, problems } = parseConstraints(file)
			const codes = unique(constraints.map((constraint) => constraint.id.split('-')[1]))
			return { markdown: file, code: codes[0] ?? null, constraints, idProblems, problems }
		})

	const records = (directory: string, pattern: RegExp, prefix: string): SpecRecord[] =>
		markdown
			.filter((file) => file.rel.startsWith(`${directory}/`) && pattern.test(basename(file.rel)))
			.map((file) => {
				const number = Number(pattern.exec(basename(file.rel))![1])
				return parseRecord(file, number, `${prefix}${pad(number, prefix === 'CONV-' ? 3 : 4)}`)
			})

	const lessons: Lesson[] = records('lessons', LESSON_FILE, '').map((record) => ({
		...record,
		kind: record.markdown.frontmatter.data.kind ?? '',
		issue: record.markdown.frontmatter.data.issue ?? '',
		skills: unique([...section(record.markdown.text, 'Skill').matchAll(/`([a-z0-9]+(?:-[a-z0-9]+)+)`/g)].map((match) => match[1])),
	}))

	let areaPaths: AreaPaths | null = null
	let areaPathsError: string | undefined
	const areaPathsFile = join(path, 'area-paths.json')
	if (isFile(areaPathsFile)) {
		try {
			const parsed = JSON.parse(readFileSync(areaPathsFile, 'utf8')) as Partial<AreaPaths>
			if (!Array.isArray(parsed.every) || typeof parsed.areas !== 'object' || parsed.areas === null || Array.isArray(parsed.areas)) areaPathsError = 'needs an "every" array and an "areas" object'
			else areaPaths = { every: parsed.every, areas: parsed.areas }
		} catch (error) {
			areaPathsError = `is not valid JSON: ${(error as Error).message}`
		}
	}

	return {
		ctx,
		name: rootName(ctx),
		path,
		markdown,
		areas,
		claims,
		pages,
		constraints: pages.flatMap((page) => page.constraints),
		decisions: records('decisions', ADR_FILE, 'ADR-'),
		conventions: records('conventions', CONV_FILE, 'CONV-'),
		lessons,
		glossary: byRel.get('glossary.md') ?? null,
		areaPaths,
		areaPathsError,
	}
}

// ---------------------------------------------------------------------------
// Glossary

export interface Ban {
	term: string
	pattern: RegExp
	exempt: string[]
	line: number
}

/** Every banned synonym in the glossary: each table with a "Banned in scenarios" column. */
export function bans(glossary: MarkdownFile | null): Ban[] {
	if (!glossary) return []
	const found: Ban[] = []
	const lines = unfenced(glossary.text)
	let header: string[] | null = null
	lines.forEach((line, index) => {
		if (!line.trim().startsWith('|')) {
			header = null
			return
		}
		const cells = splitRow(line)
		if (header === null) {
			header = cells.map((value) => value.toLowerCase())
			return
		}
		if (cells.every((value) => /^:?-+:?$/.test(value))) return
		const banned = header.indexOf('banned in scenarios')
		if (banned === -1) return
		const exemptAt = header.indexOf('exempt areas')
		const exempt = exemptAt === -1 ? [] : (cells[exemptAt] ?? '').split(/[,\s]+/).filter(Boolean)
		for (const match of (cells[banned] ?? '').matchAll(/`([^`]+)`/g)) {
			const term = match[1]
			const regex = /^\/(.+)\/([a-z]*)$/.exec(term)
			// A stateful flag would make the pattern skip every other match.
			const pattern = regex ? new RegExp(regex[1], regex[2].replace(/[gy]/g, '')) : new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
			found.push({ term, pattern, exempt, line: index + 1 })
		}
	})
	return found
}

// ---------------------------------------------------------------------------
// Checks

function frontmatterProblems(spec: Spec): Problem[] {
	const problems: Problem[] = []
	for (const file of spec.markdown) {
		const { data, error } = file.frontmatter
		if (error !== undefined) {
			problems.push({ file: file.file, line: 1, message: error })
			continue
		}
		for (const key of ['title', 'description', 'type']) {
			if (!data[key]) problems.push({ file: file.file, line: 1, message: `frontmatter has no "${key}"` })
		}
		const type = data.type
		if (type && !TYPES.includes(type as (typeof TYPES)[number])) problems.push({ file: file.file, line: 1, message: `"type: ${type}" is not one of ${TYPES.join(', ')}` })
		const expected = expectedType(spec, file)
		if (expected && type && type !== expected) problems.push({ file: file.file, line: 1, message: `"type: ${type}" but this path is a ${expected}` })
		for (const key of EXTRA_KEYS[type ?? ''] ?? []) {
			if (!data[key]) problems.push({ file: file.file, line: 1, message: `a ${type} carries "${key}"` })
		}
		if (type === 'adr' && data.status && !ADR_STATUSES.includes(data.status as (typeof ADR_STATUSES)[number])) problems.push({ file: file.file, line: 1, message: `"status: ${data.status}" is not one of ${ADR_STATUSES.join(', ')}` })
		if ((type === 'lesson' || type === 'convention') && data.status && !RECORD_STATUSES.includes(data.status as (typeof RECORD_STATUSES)[number])) problems.push({ file: file.file, line: 1, message: `"status: ${data.status}" is not one of ${RECORD_STATUSES.join(', ')}` })
		if (type === 'lesson' && data.kind && !LESSON_KINDS.includes(data.kind as (typeof LESSON_KINDS)[number])) problems.push({ file: file.file, line: 1, message: `"kind: ${data.kind}" is not one of ${LESSON_KINDS.join(', ')}` })
		if (type === 'lesson' && data.issue && !/^\d+$/.test(data.issue)) problems.push({ file: file.file, line: 1, message: `"issue: ${data.issue}" is not an issue number` })
		if (data.date && !DATE.test(data.date)) problems.push({ file: file.file, line: 1, message: `"date: ${data.date}" is not YYYY-MM-DD` })
		for (const key of ['title', 'description']) {
			if (data[key] && PLACEHOLDER.test(data[key])) problems.push({ file: file.file, line: 1, message: `a template placeholder is left in "${key}"` })
		}
		const h1 = headings(file.text).find((heading) => heading.level === 1)
		if (h1 && PLACEHOLDER.test(h1.text)) problems.push({ file: file.file, line: h1.line, message: 'a template placeholder is left in the heading' })
	}
	return problems
}

function expectedType(spec: Spec, file: MarkdownFile): string | undefined {
	const name = basename(file.rel)
	const directory = file.rel.includes('/') ? file.rel.slice(0, file.rel.indexOf('/')) : ''
	if (directory === 'decisions') return name === 'README.md' ? 'guide' : ADR_FILE.test(name) ? 'adr' : undefined
	if (directory === 'conventions') return name === 'README.md' ? 'guide' : CONV_FILE.test(name) ? 'convention' : undefined
	if (directory === 'lessons') return name === 'README.md' ? 'guide' : LESSON_FILE.test(name) ? 'lesson' : undefined
	if (directory === 'features') return name === 'README.md' ? 'spec' : undefined
	if (file.rel === 'README.md') return 'readme'
	if (file.rel === 'traceability.md') return 'guide'
	if (file.rel === 'glossary.md') return 'spec'
	if (spec.pages.some((page) => page.markdown.rel === file.rel)) return 'spec'
	return undefined
}

function areaProblems(spec: Spec): Problem[] {
	const problems: Problem[] = []
	const features = display(spec.ctx, 'features')
	if (!isFile(join(spec.path, 'features', 'README.md'))) problems.push({ file: `${features}/README.md`, message: 'the features index is missing — `init` writes it' })
	for (const directory of ['decisions', 'conventions', 'lessons']) {
		if (isDirectory(join(spec.path, directory)) && !isFile(join(spec.path, directory, 'README.md'))) problems.push({ file: display(spec.ctx, `${directory}/README.md`), message: `the ${directory} guide is missing — \`init\` writes it` })
	}
	const owners = new Map<string, string>()
	for (const area of spec.areas) {
		const readme = display(spec.ctx, `features/${area.name}/README.md`)
		if (!KEBAB.test(area.name)) problems.push({ file: `${features}/${area.name}`, message: 'an area directory is kebab-case' })
		if (area.featureText === null) problems.push({ file: display(spec.ctx, `features/${area.name}/${area.name}.feature`), message: `area "${area.name}" has no ${area.name}.feature` })
		if (!area.readme) {
			problems.push({ file: readme, message: `area "${area.name}" has no README.md` })
			continue
		}
		const { data } = area.readme.frontmatter
		if (data.area && data.area !== area.name) problems.push({ file: readme, line: 1, message: `"area: ${data.area}" does not name its directory "${area.name}"` })
		if (area.prefix === undefined) problems.push({ file: readme, line: 1, message: 'declares no "prefix:" — the claim prefix every new scenario in this area takes' })
		else if (!PREFIX.test(area.prefix)) problems.push({ file: readme, line: 1, message: `"prefix: ${area.prefix}" is not of the form REQ-<AREA>` })
		else if (owners.has(area.prefix)) problems.push({ file: readme, line: 1, message: `"prefix: ${area.prefix}" is already ${owners.get(area.prefix)}'s — each area has its own` })
		else owners.set(area.prefix, area.name)
	}
	for (const area of spec.areas) {
		const readme = display(spec.ctx, `features/${area.name}/README.md`)
		for (const kept of area.keeps) {
			if (!PREFIX.test(kept.prefix)) problems.push({ file: readme, line: 1, message: `"keeps: ${kept.raw}" is not of the form REQ-<OTHER> or REQ-<OLD>=NNN` })
			else if (kept.last === undefined && !owners.has(kept.prefix)) problems.push({ file: readme, line: 1, message: `"keeps: ${kept.raw}": a kept prefix no area issues needs its last number (REQ-<OLD>=NNN)` })
			else if (kept.last !== undefined && owners.has(kept.prefix)) problems.push({ file: readme, line: 1, message: `"keeps: ${kept.raw}": ${kept.prefix} is still issued by ${owners.get(kept.prefix)}; keep it without a last number` })
		}
	}
	const areaPaths = display(spec.ctx, 'area-paths.json')
	if (spec.areaPathsError !== undefined) problems.push({ file: areaPaths, line: 1, message: spec.areaPathsError })
	else if (!spec.areaPaths) problems.push({ file: areaPaths, message: 'is missing — `init` writes it' })
	else {
		const names = new Set(spec.areas.map((area) => area.name))
		for (const area of spec.areas) {
			if (!(area.name in spec.areaPaths.areas)) problems.push({ file: areaPaths, line: 1, message: `area "${area.name}" has no entry under "areas"` })
		}
		for (const name of Object.keys(spec.areaPaths.areas)) {
			if (!names.has(name)) problems.push({ file: areaPaths, line: 1, message: `"areas.${name}" names no feature area` })
		}
	}
	return problems
}

/** Where claim IDs are valid; also run by `generate`, which fails on them. */
function claimProblems(spec: Spec): Problem[] {
	const problems: Problem[] = []
	const live = new Map(spec.areas.filter((area) => area.prefix).map((area) => [area.prefix!, area.name]))
	const seen = new Map<string, string>()
	for (const area of spec.areas) {
		if (!area.feature || !area.featureFile) continue
		const file = area.featureFile
		// No README, or no prefix: areaProblems names that; blaming every claim here would hide it.
		if (!area.prefix) continue
		const allowed = new Map<string, number | undefined>([[area.prefix, undefined], ...area.keeps.map((kept) => [kept.prefix, kept.last] as [string, number | undefined])])
		for (const scenario of area.feature.scenarios) {
			const where = `${scenario.keyword} "${scenario.name}"`
			const reqTags = scenario.tags.filter((tag) => tag.startsWith('@REQ-'))
			const valid = reqTags.filter((tag) => CLAIM.test(tag.slice(1)))
			for (const tag of reqTags) {
				if (!CLAIM.test(tag.slice(1))) problems.push({ file, line: scenario.line, message: `${where}: tag "${tag}" is not of the form @REQ-<AREA>-NNN` })
			}
			if (valid.length === 0) problems.push({ file, line: scenario.line, message: `${where} has no @REQ-<AREA>-NNN claim tag` })
			else if (valid.length > 1) problems.push({ file, line: scenario.line, message: `${where} carries ${valid.length} claim tags; exactly one` })
			else {
				const id = valid[0].slice(1)
				const prefix = id.slice(0, id.lastIndexOf('-'))
				const number = Number(id.slice(-3))
				if (seen.has(id)) problems.push({ file, line: scenario.line, message: `${id} is already claimed by ${seen.get(id)} — an ID is never reused` })
				else seen.set(id, `${file}:${scenario.line}`)
				if (!allowed.has(prefix)) {
					problems.push({
						file,
						line: scenario.line,
						message: live.has(prefix) ? `${id} carries ${live.get(prefix)}'s prefix; a moved scenario's area lists it under "keeps:"` : `${id} carries a prefix no area declares or keeps`,
					})
				} else {
					const last = allowed.get(prefix)
					if (last !== undefined && number > last) problems.push({ file, line: scenario.line, message: `${id} is above ${prefix}'s last issued number ${pad(last, 3)} — a retired prefix issues nothing new` })
				}
			}
			const issueTags = scenario.tags.filter((tag) => /^@issue/i.test(tag))
			const validIssues = issueTags.filter((tag) => /^@issue-\d+$/.test(tag))
			for (const tag of issueTags) {
				if (!/^@issue-\d+$/.test(tag)) problems.push({ file, line: scenario.line, message: `${where}: tag "${tag}" is not of the form @issue-<N>` })
			}
			if (scenario.tags.includes('@ignore')) {
				if (validIssues.length !== 1) problems.push({ file, line: scenario.line, message: `${where} is @ignore and names ${validIssues.length === 0 ? 'no' : validIssues.length} @issue-<N>; exactly one` })
			} else if (issueTags.length > 0) problems.push({ file, line: scenario.line, message: `${where} names an issue but is not @ignore` })
		}
	}
	return problems
}

function lintProblems(spec: Spec): Problem[] {
	const problems: Problem[] = []
	const banned = bans(spec.glossary)
	for (const area of spec.areas) {
		if (!area.feature || !area.featureFile) continue
		const file = area.featureFile
		const applicable = banned.filter((ban) => !ban.exempt.includes(area.name))
		const texts: { text: string; line: number; what: string }[] = [{ text: area.feature.title, line: area.feature.line, what: 'the feature title' }]
		for (const { line, text } of area.feature.malformed) problems.push({ file, line, message: `"${text}" is a step keyword with no step — write the step, or delete the line` })
		for (const scenario of area.feature.scenarios) {
			const where = `${scenario.keyword} "${scenario.name}"`
			const whens = scenario.steps.filter((step) => step.keyword === 'When').length
			if (whens > 1) problems.push({ file, line: scenario.line, message: `${where} has ${whens} action steps; one When per scenario` })
			if (scenario.steps.length > 8) problems.push({ file, line: scenario.line, message: `${where} has ${scenario.steps.length} steps; at most 8` })
			texts.push({ text: scenario.name, line: scenario.line, what: 'the title' })
			for (const step of scenario.steps) texts.push({ text: step.text, line: step.line, what: 'a step' })
			// A cell counts as step text only when a step or the title reads its column through <header>.
			const read = new Set([scenario.name, ...scenario.steps.map((step) => step.text)].flatMap((value) => [...value.matchAll(/<([^<>]+)>/g)].map((match) => match[1])))
			for (const row of scenario.examples) {
				row.cells.forEach((value, column) => {
					if (read.has(row.headers[column] ?? '')) texts.push({ text: value, line: row.line, what: `the Examples column "${row.headers[column]}"` })
				})
			}
		}
		for (const { text, line, what } of texts) {
			const plain = bare(text)
			const mechanics = MECHANICS.exec(plain)
			if (mechanics) problems.push({ file, line, message: `${what} drives the browser ("${mechanics[0]}") — say what the actor does or sees` })
			for (const { pattern, why } of TRANSPORT) {
				const match = pattern.exec(plain)
				if (match) problems.push({ file, line, message: `${what} names ${why} ("${match[0]}") — describe the behaviour` })
			}
			for (const ban of applicable) {
				const match = ban.pattern.exec(plain)
				if (match) problems.push({ file, line, message: `${what} uses "${match[0]}", which the glossary bans (\`${ban.term}\`)` })
			}
		}
		if (area.readme) {
			const lines = unfenced(area.readme.text)
			lines.forEach((line, index) => {
				if (index <= area.readme!.frontmatter.end) return
				const plain = prose(line)
				for (const ban of applicable) {
					const match = ban.pattern.exec(plain)
					if (match) problems.push({ file: area.readme!.file, line: index + 1, message: `uses "${match[0]}", which the glossary bans (\`${ban.term}\`)` })
				}
			})
		}
	}
	return problems
}

/** Where constraint IDs are valid; also run by `generate`, which fails on them. */
function constraintIdProblems(spec: Spec): Problem[] {
	const problems: Problem[] = spec.pages.flatMap((page) => page.idProblems)
	const codes = new Map<string, string>()
	const seen = new Map<string, string>()
	for (const page of spec.pages) {
		const file = page.markdown.file
		const pageCodes = unique(page.constraints.map((constraint) => constraint.id.split('-')[1]))
		if (pageCodes.length > 1) problems.push({ file, message: `uses ${pageCodes.length} constraint codes (${pageCodes.join(', ')}); one code per page` })
		for (const code of pageCodes) {
			if (codes.has(code) && codes.get(code) !== file) problems.push({ file, message: `constraint code CON-${code} is already ${codes.get(code)}'s` })
			else codes.set(code, file)
		}
		for (const constraint of page.constraints) {
			if (seen.has(constraint.id)) problems.push({ file, line: constraint.line, message: `${constraint.id} is already declared at ${seen.get(constraint.id)}` })
			else seen.set(constraint.id, `${file}:${constraint.line}`)
		}
	}
	return problems
}

function constraintProblems(spec: Spec): Problem[] {
	const problems = [...constraintIdProblems(spec), ...spec.pages.flatMap((page) => page.problems)]
	const claims = new Set(spec.claims.map((claim) => claim.id))
	for (const constraint of spec.constraints) {
		for (const id of constraint.verifiedBy) {
			if (!claims.has(id)) problems.push({ file: display(spec.ctx, constraint.page), line: constraint.line, message: `${constraint.id} is verified by ${id}, which no scenario claims` })
		}
	}
	return problems
}

function recordShapeProblems(record: SpecRecord, label: string, allowed: readonly string[], required: readonly string[]): Problem[] {
	const problems: Problem[] = []
	const { file } = record.markdown
	if (!record.heading) {
		problems.push({ file, message: `has no "# ${label} — <title>" heading` })
		return problems
	}
	const match = new RegExp(`^${label.replace(/[-]/g, '\\-')}\\s+—\\s+(.+)$`).exec(record.heading.text)
	if (!match) problems.push({ file, line: record.heading.line, message: `the heading is "# ${label} — <title>", in step with the filename` })
	else if (match[1] !== record.title) problems.push({ file, line: record.heading.line, message: `the heading's title differs from the frontmatter title` })
	let position = -1
	for (const heading of record.sections) {
		const index = allowed.indexOf(heading.text)
		if (index === -1) problems.push({ file, line: heading.line, message: `"## ${heading.text}" is not a section of a ${label.split(/[- ]/)[0]}; the sections are ${allowed.join(', ')}` })
		else if (index <= position) problems.push({ file, line: heading.line, message: `"## ${heading.text}" is out of order; the sections are ${allowed.join(', ')}` })
		else position = index
	}
	for (const name of required) {
		if (!record.sections.some((heading) => heading.text === name)) problems.push({ file, message: `has no "## ${name}" section` })
	}
	return problems
}

function fileProblems(spec: Spec, directory: string, pattern: RegExp, form: string, records: SpecRecord[]): Problem[] {
	const problems: Problem[] = []
	for (const name of listDirectory(join(spec.path, directory))) {
		if (name === 'README.md' || !isFile(join(spec.path, directory, name))) continue
		if (!pattern.test(name)) problems.push({ file: display(spec.ctx, `${directory}/${name}`), message: `is neither README.md nor ${form}` })
	}
	const numbers = new Map<number, string>()
	for (const record of records) {
		if (numbers.has(record.number)) problems.push({ file: record.markdown.file, message: `number ${record.number} is already ${numbers.get(record.number)}'s — a number is never reused` })
		else numbers.set(record.number, record.markdown.file)
	}
	return problems
}

function decisionProblems(spec: Spec): Problem[] {
	const problems = fileProblems(spec, 'decisions', ADR_FILE, 'ADR-NNNN-<slug>.md', spec.decisions)
	const ids = new Set([...spec.decisions.map((record) => record.id), ...spec.conventions.map((record) => record.id)])
	for (const record of spec.decisions) {
		const { file } = record.markdown
		problems.push(...recordShapeProblems(record, record.id, ADR_SECTIONS, REQUIRED_ADR_SECTIONS))
		if (record.sections.some((heading) => /^Amendment\b/.test(heading.text))) problems.push({ file, message: 'carries an amendment — a change to a decision is a new ADR that supersedes this one' })
		if (!record.statusLine) {
			problems.push({ file, message: 'has no `**Status:**` paragraph directly under the heading' })
			continue
		}
		const { text, line } = record.statusLine
		const word = record.status ? record.status[0].toUpperCase() + record.status.slice(1) : ''
		const opening = text.replace(/^\*\*Status:\*\*\s*/, '')
		if (word && !opening.startsWith(word)) problems.push({ file, line, message: `the status line opens with "${opening.split(/[.\s]/)[0]}" but the frontmatter says "status: ${record.status}"` })
		if (PLACEHOLDER.test(text)) problems.push({ file, line, message: 'a template placeholder is left in the status line' })
		if (record.status === 'superseded' || record.status === 'deprecated') {
			const linked = unique([...matches(text, ADR_ANY), ...matches(text, CONV_ANY)]).filter((id) => id !== record.id)
			if (linked.length === 0) problems.push({ file, line, message: `a ${record.status} record's status line links the ADR or convention that replaced it` })
			for (const id of linked) if (!ids.has(id)) problems.push({ file, line, message: `names ${id}, which does not exist` })
		}
	}
	return problems
}

function conventionProblems(spec: Spec): Problem[] {
	const problems = fileProblems(spec, 'conventions', CONV_FILE, 'CONV-NNN-<slug>.md', spec.conventions)
	for (const record of spec.conventions) problems.push(...recordShapeProblems(record, record.id, CONVENTION_SECTIONS, ['Rule', 'Why']))
	return problems
}

function lessonProblems(spec: Spec): Problem[] {
	const problems = fileProblems(spec, 'lessons', LESSON_FILE, 'NNNN-<slug>.md', spec.lessons)
	const claims = new Set([...spec.claims.map((claim) => claim.id), ...spec.constraints.map((constraint) => constraint.id)])
	const conventions = new Set(spec.conventions.map((record) => record.id))
	for (const lesson of spec.lessons) {
		const { file, text } = lesson.markdown
		const required = lesson.kind === 'incident' ? ['Symptom', 'Root cause'] : LESSON_SECTIONS
		problems.push(...recordShapeProblems(lesson, `Lesson ${pad(lesson.number, 4)}`, LESSON_SECTIONS, required))
		if (lesson.kind === 'product') {
			const named = [...matches(section(text, 'Spec delta'), CLAIM_ANY), ...matches(section(text, 'Spec delta'), CONSTRAINT_ANY)]
			if (named.length === 0) problems.push({ file, message: 'a product lesson\'s "## Spec delta" names the REQ- or CON- ID that is its remedy' })
			for (const id of named) if (!claims.has(id)) problems.push({ file, message: `"## Spec delta" names ${id}, which does not exist` })
		}
		if (lesson.kind === 'process') {
			const named = matches(section(text, 'Skill'), CONV_ANY)
			if (lesson.skills.length === 0 && named.length === 0) problems.push({ file, message: 'a process lesson\'s "## Skill" names the skill (`skill-name`) or convention (CONV-NNN) that now carries the rule' })
			for (const id of named) if (!conventions.has(id)) problems.push({ file, message: `"## Skill" names ${id}, which does not exist` })
		}
	}
	return problems
}

function linkProblems(spec: Spec): Problem[] {
	const problems: Problem[] = []
	const known = new Map<string, Set<string>>()
	const anchorsOf = (abs: string): Set<string> => {
		if (!known.has(abs)) known.set(abs, anchors(readFileSync(abs, 'utf8').replace(/\r\n?/g, '\n')))
		return known.get(abs)!
	}
	for (const file of spec.markdown) {
		const raw = file.text.split('\n')
		let fence: string | undefined
		raw.forEach((line, index) => {
			const mark = /^\s*(```+|~~~+)/.exec(line)
			if (fence === undefined && mark) {
				fence = mark[1]
				if (DIAGRAM_FENCE.test(line)) problems.push({ file: file.file, line: index + 1, message: `a ${DIAGRAM_FENCE.exec(line)![1]} fence — every diagram is a fenced mermaid block` })
			} else if (fence !== undefined && mark && mark[1][0] === fence[0] && mark[1].length >= fence.length) fence = undefined
		})
		unfenced(file.text).forEach((line, index) => {
			const plain = line.replace(/`[^`]*`/g, '')
			if (plain.includes('![')) problems.push({ file: file.file, line: index + 1, message: 'an image — every diagram is a fenced mermaid block, and a screenshot belongs in a guide' })
			for (const match of plain.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
				const target = match[1]
				if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue
				const [path, hash] = target.split('#')
				let decoded: string
				try {
					decoded = decodeURI(path)
				} catch {
					problems.push({ file: file.file, line: index + 1, message: `links to ${target}, which is not a valid URI` })
					continue
				}
				const abs = path === '' ? file.abs : resolve(dirname(file.abs), decoded)
				if (!existsSync(abs)) {
					problems.push({ file: file.file, line: index + 1, message: `links to ${target}, which does not exist` })
					continue
				}
				if (hash !== undefined && abs.endsWith('.md') && !anchorsOf(abs).has(hash.toLowerCase())) problems.push({ file: file.file, line: index + 1, message: `links to ${target}, and no heading there has that anchor` })
			}
		})
	}
	return problems
}

function generatedProblems(spec: Spec): Problem[] {
	const problems: Problem[] = []
	const files = generated(spec)
	for (const name of GENERATED) {
		const abs = join(spec.path, name)
		const file = display(spec.ctx, name)
		if (!isFile(abs)) problems.push({ file, message: 'is missing — run `generate`' })
		else if (readFileSync(abs, 'utf8') !== files[name]) problems.push({ file, message: 'differs from what `generate` writes — run `generate` and commit the result' })
	}
	return problems
}

/** Every structural problem under the root, sorted. */
export function checkProblems(ctx: Context): Problem[] {
	if (!isDirectory(rootPath(ctx))) return [{ file: rootName(ctx), message: 'is not a directory — run `init`' }]
	const spec = readSpec(ctx)
	return sortProblems([
		...frontmatterProblems(spec),
		...areaProblems(spec),
		...claimProblems(spec),
		...lintProblems(spec),
		...constraintProblems(spec),
		...decisionProblems(spec),
		...conventionProblems(spec),
		...lessonProblems(spec),
		...linkProblems(spec),
		...generatedProblems(spec),
	])
}

export function check(ctx: Context): Result {
	const problems = checkProblems(ctx)
	if (problems.length > 0) return fail(...problems.map(problemLine))
	return ok(`${rootName(ctx)}: every rule holds.`)
}

// ---------------------------------------------------------------------------
// Generated files

const GENERATED_NOTE = ['> **Generated file — do not edit by hand.**', '> Regenerate with `sdd.ts generate`; `sdd.ts check` fails on a difference.']

function table(header: string[], rows: string[][]): string[] {
	if (rows.length === 0) return ['None.']
	return [`| ${header.join(' | ')} |`, `|${header.map(() => '---').join('|')}|`, ...rows.map((row) => `| ${row.join(' | ')} |`)]
}

const byNumberDesc = (a: SpecRecord, b: SpecRecord): number => b.number - a.number

/** What a lesson changed upstream: claims under `## Scenario`, skills and conventions under `## Skill`. */
export function remedy(lesson: Lesson): string {
	const claims = matches(section(lesson.markdown.text, 'Scenario'), CLAIM_ANY)
	const conventions = matches(section(lesson.markdown.text, 'Skill'), CONV_ANY)
	const parts = [...claims, ...lesson.skills.map((skill) => `\`${skill}\``), ...conventions]
	return parts.length > 0 ? parts.join(', ') : 'none'
}

function indexOf(spec: Spec): string {
	const lines = [
		'---',
		'title: Specification index',
		'description: Generated index of every feature area, constraint page, decision, convention, and lesson in the specification.',
		'type: readme',
		'---',
		'',
		'# Specification index',
		'',
		...GENERATED_NOTE,
		'',
		'The authority rules, the product contract, and the guardrails are in',
		'[`features/README.md`](features/README.md). Every claim and constraint, with',
		'what verifies it, is in [`traceability.md`](traceability.md), and as data in',
		'[`claims.json`](claims.json). The words scenarios use, and the synonyms they',
		'may not, are in [`glossary.md`](glossary.md).',
		'',
		'## Feature areas',
		'',
		'Each area is one `.feature` file of scenarios and a README with the detail',
		'Gherkin cannot hold, including what not to build. A new claim takes the',
		"area's prefix; a scenario moved from another area keeps its ID, under a",
		'prefix shown after it.',
		'',
	]
	lines.push(
		...table(
			['Area', 'Claims', 'Scenarios', 'Planned (`@ignore`)', 'Browser (`@ui`)', 'Supporting detail'],
			spec.areas.map((area) => {
				const claims = spec.claims.filter((claim) => claim.area === area.name)
				const scenarios = area.feature?.scenarios ?? []
				const others = unique(claims.map((claim) => claim.id.slice(0, claim.id.lastIndexOf('-')))).filter((prefix) => prefix !== area.prefix)
				const prefix = area.prefix ? `\`${area.prefix}\`` : '—'
				return [
					`[${cell(area.title)}](features/${area.name}/${area.name}.feature)`,
					others.length > 0 ? `${prefix} (also ${others.map((value) => `\`${value}\``).join(', ')})` : prefix,
					String(scenarios.length),
					String(scenarios.filter((scenario) => scenario.tags.includes('@ignore')).length),
					String(scenarios.filter((scenario) => scenario.tags.includes('@ui')).length),
					area.readme ? `[README](features/${area.name}/README.md) — ${cell(area.description)}` : '—',
				]
			}),
		),
		'',
		'## Constraint pages',
		'',
		'Each normative constraint carries a `CON-*` ID naming the claims that verify it.',
		'',
		...table(
			['Page', 'Constraints', 'Count', 'Description'],
			spec.pages.map((page) => [`[${cell(page.markdown.frontmatter.data.title)}](${page.markdown.rel})`, page.code ? `\`CON-${page.code}\`` : '—', String(page.constraints.length), cell(page.markdown.frontmatter.data.description)]),
		),
		'',
		'## Decisions',
		'',
		'Architecture decision records, newest first. What an ADR is for:',
		'[`decisions/README.md`](decisions/README.md).',
		'',
		...table(
			['ADR', 'Title', 'Status', 'Date'],
			[...spec.decisions].sort(byNumberDesc).map((record) => [`[${pad(record.number, 4)}](decisions/${basename(record.markdown.rel)})`, cell(record.title), cell(record.status), cell(record.date)]),
		),
		'',
		'## Conventions',
		'',
		'Process, tooling, and agent-workflow rules, newest first. What a',
		'convention is: [`conventions/README.md`](conventions/README.md).',
		'',
		...table(
			['Convention', 'Title', 'Status', 'Date'],
			[...spec.conventions].sort(byNumberDesc).map((record) => [`[${record.id}](conventions/${basename(record.markdown.rel)})`, cell(record.title), cell(record.status), cell(record.date)]),
		),
		'',
		'## Lessons',
		'',
		'What the specification should have said, newest first. When to write one:',
		'[`lessons/README.md`](lessons/README.md).',
		'',
		...table(
			['Lesson', 'Title', 'What it cost us', 'Remedy', 'Issue', 'Date', 'Status', 'Kind'],
			[...spec.lessons].sort(byNumberDesc).map((lesson) => [
				`[${pad(lesson.number, 4)}](lessons/${basename(lesson.markdown.rel)})`,
				cell(lesson.title),
				cell(lesson.markdown.frontmatter.data.description),
				cell(remedy(lesson)),
				lesson.issue ? `#${lesson.issue}` : '—',
				cell(lesson.date),
				cell(lesson.status),
				cell(lesson.kind),
			]),
		),
		'',
	)
	return lines.join('\n')
}

function traceabilityOf(spec: Spec): string {
	const lines = [
		'---',
		'title: Traceability',
		'description: Generated matrix of every claim — its scenario, area, engine, and status — and every constraint with the claims that verify it.',
		'type: guide',
		'---',
		'',
		'# Traceability',
		'',
		...GENERATED_NOTE,
		'> The same data with every step and citation is [`claims.json`](claims.json).',
		'',
		'A `Planned` claim is still `@ignore`; a `Built` one is not. A claim tagged',
		'`@ui` runs in the browser runner (`browser`); any other runs in the',
		"project's Gherkin runner (`application`).",
		'',
		'## Claims',
		'',
		...table(
			['Claim', 'Scenario', 'Area', 'Engine', 'Status'],
			[...spec.claims].sort((a, b) => compare(a.id, b.id)).map((claim) => [claim.id, cell(claim.title), claim.area, claim.engine, claim.status]),
		),
		'',
		'## Constraints',
		'',
		...table(
			['Constraint', 'Page', 'Verified by'],
			[...spec.constraints].sort((a, b) => compare(a.id, b.id)).map((constraint) => [constraint.id, `[${constraint.page}](${constraint.page})`, constraint.verifiedBy.length > 0 ? constraint.verifiedBy.join(', ') : 'none']),
		),
		'',
	]
	return lines.join('\n')
}

function claimsOf(spec: Spec): string {
	const claims = [...spec.claims].sort((a, b) => compare(a.id, b.id))
	const cites = (text: string) => ({ claims: matches(text, CLAIM_ANY), constraints: matches(text, CONSTRAINT_ANY), decisions: matches(text, ADR_ANY) })
	const decisions = [...spec.decisions].sort((a, b) => a.number - b.number)
	const lessons = [...spec.lessons].sort((a, b) => a.number - b.number)
	const data = {
		areas: spec.areas.map((area) => ({
			name: area.name,
			prefix: area.prefix ?? null,
			prefixes: unique([...(area.prefix ? [area.prefix] : []), ...spec.claims.filter((claim) => claim.area === area.name).map((claim) => claim.id.slice(0, claim.id.lastIndexOf('-')))]),
		})),
		claims: claims.map((claim) => ({
			id: claim.id,
			area: claim.area,
			file: claim.file,
			title: claim.title,
			rule: claim.rule,
			tags: claim.tags,
			engine: claim.engine,
			status: claim.status,
			steps: claim.steps.map((step) => ({ keyword: step.keyword, text: step.text })),
			constraints: spec.constraints.filter((constraint) => constraint.verifiedBy.includes(claim.id)).map((constraint) => constraint.id).sort(),
			citedBy: {
				decisions: decisions.filter((record) => record.markdown.text.includes(claim.id)).map((record) => record.id),
				lessons: lessons.filter((lesson) => lesson.markdown.text.includes(claim.id)).map((lesson) => pad(lesson.number, 4)),
			},
		})),
		constraints: [...spec.constraints].sort((a, b) => compare(a.id, b.id)).map((constraint) => ({ id: constraint.id, page: display(spec.ctx, constraint.page), verifiedBy: constraint.verifiedBy, note: constraint.note })),
		decisions: decisions.map((record) => ({
			id: record.id,
			file: record.markdown.file,
			title: record.title,
			status: record.status,
			...cites(record.markdown.text),
			decisions: cites(record.markdown.text).decisions.filter((id) => id !== record.id),
			supersedes: decisions.filter((other) => other.status === 'superseded' && other.statusLine?.text.includes(record.id)).map((other) => other.id),
		})),
		lessons: lessons.map((lesson) => ({
			id: pad(lesson.number, 4),
			file: lesson.markdown.file,
			title: lesson.title,
			status: lesson.status,
			kind: lesson.kind,
			...cites(lesson.markdown.text),
			skills: lesson.skills,
		})),
	}
	return `${JSON.stringify(data, null, '\t')}\n`
}

export function generated(spec: Spec): Record<string, string> {
	return { 'README.md': indexOf(spec), 'traceability.md': traceabilityOf(spec), 'claims.json': claimsOf(spec) }
}

export function generate(ctx: Context, options: { check?: boolean } = {}): Result {
	if (!isDirectory(rootPath(ctx))) return fail(`error: ${rootName(ctx)} is not a directory — run \`init\``)
	const spec = readSpec(ctx)
	const features = `${display(ctx, 'features')}/`
	const problems = sortProblems([...areaProblems(spec).filter((problem) => problem.file.startsWith(features)), ...claimProblems(spec), ...constraintIdProblems(spec)])
	if (problems.length > 0) return fail(...problems.map(problemLine))
	const files = generated(spec)
	if (options.check) {
		const stale = GENERATED.filter((name) => !isFile(join(spec.path, name)) || readFileSync(join(spec.path, name), 'utf8') !== files[name])
		if (stale.length > 0) return fail(...stale.map((name) => `::error file=${display(ctx, name)}::differs from what \`generate\` writes — run \`generate\` and commit the result`))
		return ok(`${GENERATED.length} generated file(s) are current.`)
	}
	for (const name of GENERATED) writeFileSync(join(spec.path, name), files[name])
	return ok(`${spec.name}: wrote ${GENERATED.join(', ')} — ${spec.claims.length} claim(s), ${spec.constraints.length} constraint(s), ${spec.decisions.length} decision(s), ${spec.conventions.length} convention(s), ${spec.lessons.length} lesson(s).`)
}

// ---------------------------------------------------------------------------
// Templates and numbering

export function render(template: string, tokens: Record<string, string>): string {
	const path = join(TEMPLATES, template)
	if (!isFile(path)) throw new Error(`template ${template} is missing from ${TEMPLATES}`)
	const text = readFileSync(path, 'utf8').replace(/\{\{([a-z]+)\}\}/g, (whole, key: string) => (key in tokens ? tokens[key] : whole))
	const left = text.match(/\{\{[a-z]+\}\}/g)
	if (left) throw new Error(`template ${template} has unfilled token(s): ${unique(left).join(', ')}`)
	return text
}

export const slugify = (title: string): string =>
	title
		.toLowerCase()
		.replace(/['’]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')

export function today(): string {
	const now = new Date()
	return `${now.getFullYear()}-${pad(now.getMonth() + 1, 2)}-${pad(now.getDate(), 2)}`
}

function git(cwd: string, args: string[]): string | undefined {
	try {
		return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
	} catch {
		return undefined
	}
}

const remoteRefs = (cwd: string): string[] => (git(cwd, ['for-each-ref', '--format=%(refname)', 'refs/remotes']) ?? '').split('\n').filter(Boolean)
const remoteFiles = (cwd: string, ref: string, directory: string): string[] => (git(cwd, ['ls-tree', '-r', '--name-only', ref, '--', directory]) ?? '').split('\n').filter(Boolean)

const highest = (names: readonly string[], pattern: RegExp): number => names.reduce((max, name) => Math.max(max, Number(pattern.exec(name)?.[1] ?? 0)), 0)

/** The highest number a record directory holds, here and on every remote branch. */
function highestNumber(ctx: Context, directory: string, pattern: RegExp): number {
	const local = listDirectory(join(rootPath(ctx), directory))
	const remote = remoteRefs(ctx.cwd).flatMap((ref) => remoteFiles(ctx.cwd, ref, posix.join(rootName(ctx), directory)).map((path) => basename(path)))
	return highest([...local, ...remote], pattern)
}

export const nextAdrNumber = (ctx: Context): number => highestNumber(ctx, 'decisions', /^ADR-(\d{4})-/) + 1
export const nextConventionNumber = (ctx: Context): number => highestNumber(ctx, 'conventions', /^CONV-(\d{3})-/) + 1
export const nextLessonNumber = (ctx: Context): number => highestNumber(ctx, 'lessons', /^(\d{4})-/) + 1

/** The next unused claim ID under `prefix`, counting every feature file here and on every remote branch. */
export function nextClaimId(ctx: Context, prefix: string): string {
	const pattern = new RegExp(`${prefix}-(\\d{3})\\b`, 'g')
	const texts: string[] = []
	const features = join(rootPath(ctx), 'features')
	for (const area of listDirectory(features)) {
		const file = join(features, area, `${area}.feature`)
		if (isFile(file)) texts.push(readFileSync(file, 'utf8'))
	}
	// One grep per remote ref, rather than one show per feature file per ref.
	for (const ref of remoteRefs(ctx.cwd)) texts.push(git(ctx.cwd, ['grep', '-h', '-o', '-E', `${prefix}-[0-9]{3}`, ref, '--', posix.join(rootName(ctx), 'features')]) ?? '')
	// A commented-out line claims nothing: the template's example carries an ID.
	const uncommented = (text: string): string => text.split('\n').filter((line) => !line.trim().startsWith('#')).join('\n')
	const max = highest(texts.flatMap((text) => uncommented(text).match(pattern) ?? []), new RegExp(`${prefix}-(\\d{3})`))
	return `${prefix}-${pad(max + 1, 3)}`
}

// ---------------------------------------------------------------------------
// Commands that write

function write(ctx: Context, rel: string, text: string, result: { written: string[]; skipped: string[] }): void {
	const abs = join(rootPath(ctx), rel)
	if (existsSync(abs)) {
		result.skipped.push(display(ctx, rel))
		return
	}
	mkdirSync(dirname(abs), { recursive: true })
	writeFileSync(abs, text)
	result.written.push(display(ctx, rel))
}

/** `result` with the generated files rewritten, so a fresh tree never fails `check` on a stale index. */
function regenerated(ctx: Context, result: Result): Result {
	if (result.code !== 0) return result
	const generation = generate(ctx)
	if (generation.code !== 0) return generation
	return ok(...result.output, ...GENERATED.map((name) => `wrote ${display(ctx, name)}`))
}

function constraintPage(slug: string, code: string, title: string): string {
	return render('constraint-page.md', { title, slug, page: code })
}

export function init(ctx: Context, options: { project?: string; deciders?: string }): Result {
	if (!options.project) return fail('error: init needs --project "<Name>"')
	const root = rootName(ctx)
	const result = { written: [] as string[], skipped: [] as string[] }
	write(ctx, 'area-paths.json', render('area-paths.json', {}), result)
	write(ctx, 'glossary.md', render('glossary.md', {}), result)
	write(ctx, 'system-overview.md', constraintPage('system-overview', 'SO', 'System overview'), result)
	write(ctx, 'testing-and-quality.md', constraintPage('testing-and-quality', 'TQ', 'Testing and quality'), result)
	write(ctx, 'features/README.md', render('features-readme.md', { project: options.project, root }), result)
	write(ctx, 'decisions/README.md', render('decisions-readme.md', {}), result)
	write(ctx, 'conventions/README.md', render('conventions-readme.md', {}), result)
	write(ctx, 'lessons/README.md', render('lessons-readme.md', {}), result)
	const generation = generate(ctx)
	if (generation.code !== 0) return generation
	const output = [
		...result.written.map((file) => `wrote ${file}`),
		...result.skipped.map((file) => `kept ${file} (exists)`),
		...GENERATED.map((name) => `wrote ${display(ctx, name)}`),
		'',
		'Paste this into AGENTS.md (or CLAUDE.md), then fill in the placeholders:',
		'',
		render('agents-section.md', { root }),
	]
	return ok(...output)
}

export function newFeature(ctx: Context, area: string | undefined, prefix: string | undefined, title: string | undefined): Result {
	if (!area || !KEBAB.test(area)) return fail('error: new feature needs a kebab-case <area>')
	const code = (prefix ?? '').replace(/^REQ-/, '')
	if (!CODE.test(code)) return fail('error: new feature needs --prefix <AREA>, upper-case letters')
	if (!title) return fail('error: new feature needs --title "<Title>"')
	if (!isDirectory(rootPath(ctx))) return fail(`error: ${rootName(ctx)} is not a directory — run \`init\``)
	const spec = readSpec(ctx)
	if (spec.areas.some((existing) => existing.name === area)) return fail(`error: area "${area}" already exists`)
	const owner = spec.areas.find((existing) => existing.prefix === `REQ-${code}`)
	if (owner) return fail(`error: prefix REQ-${code} is already ${owner.name}'s`)
	if (spec.areaPathsError !== undefined) return fail(`error: ${display(ctx, 'area-paths.json')} ${spec.areaPathsError} — fix it before adding an area`)
	const result = { written: [] as string[], skipped: [] as string[] }
	write(ctx, `features/${area}/${area}.feature`, render('feature.feature', { title, area, prefix: code }), result)
	write(ctx, `features/${area}/README.md`, render('area-readme.md', { title, area, prefix: code }), result)
	const areaPaths = spec.areaPaths ?? { every: [], areas: {} }
	if (!(area in areaPaths.areas)) {
		areaPaths.areas[area] = []
		const sorted = Object.fromEntries(Object.keys(areaPaths.areas).sort().map((name) => [name, areaPaths.areas[name]]))
		writeFileSync(join(rootPath(ctx), 'area-paths.json'), `${JSON.stringify({ every: areaPaths.every, areas: sorted }, null, '\t')}\n`)
		result.written.push(display(ctx, 'area-paths.json'))
	}
	return regenerated(ctx, ok(...result.written.map((file) => `wrote ${file}`), `next claim: REQ-${code}-001`))
}

export function newPage(ctx: Context, slug: string | undefined, prefix: string | undefined, title: string | undefined): Result {
	if (!slug || !KEBAB.test(slug)) return fail('error: new page needs a kebab-case <slug>')
	const code = (prefix ?? '').replace(/^CON-/, '')
	if (!CODE.test(code)) return fail('error: new page needs --prefix <PAGE>, upper-case letters')
	if (!title) return fail('error: new page needs --title "<Title>"')
	if (!isDirectory(rootPath(ctx))) return fail(`error: ${rootName(ctx)} is not a directory — run \`init\``)
	const spec = readSpec(ctx)
	const owner = spec.pages.find((page) => page.code === code)
	if (owner) return fail(`error: constraint code CON-${code} is already ${owner.markdown.file}'s`)
	if (isFile(join(rootPath(ctx), `${slug}.md`))) return fail(`error: ${display(ctx, `${slug}.md`)} already exists`)
	const result = { written: [] as string[], skipped: [] as string[] }
	write(ctx, `${slug}.md`, constraintPage(slug, code, title), result)
	return regenerated(ctx, ok(...result.written.map((file) => `wrote ${file}`)))
}

function newRecord(ctx: Context, directory: string, filename: string, template: string, tokens: Record<string, string>): Result {
	if (!isDirectory(rootPath(ctx))) return fail(`error: ${rootName(ctx)} is not a directory — run \`init\``)
	const result = { written: [] as string[], skipped: [] as string[] }
	const rel = `${directory}/${filename}`
	if (isFile(join(rootPath(ctx), rel))) return fail(`error: ${display(ctx, rel)} already exists`)
	write(ctx, rel, render(template, tokens), result)
	return regenerated(ctx, ok(...result.written.map((file) => `wrote ${file}`)))
}

export function newAdr(ctx: Context, title: string | undefined, deciders?: string): Result {
	if (!title) return fail('error: new adr needs a "<title>"')
	const number = pad(nextAdrNumber(ctx), 4)
	const who = deciders || git(ctx.cwd, ['config', 'user.name'])?.trim() || '<names>'
	return newRecord(ctx, 'decisions', `ADR-${number}-${slugify(title)}.md`, 'adr.md', { title, number, date: today(), deciders: who })
}

export function newConvention(ctx: Context, title: string | undefined): Result {
	if (!title) return fail('error: new convention needs a "<title>"')
	const number = pad(nextConventionNumber(ctx), 3)
	return newRecord(ctx, 'conventions', `CONV-${number}-${slugify(title)}.md`, 'convention.md', { title, number, date: today() })
}

export function newLesson(ctx: Context, title: string | undefined, issue: string | undefined, kind: string | undefined): Result {
	if (!title) return fail('error: new lesson needs a "<title>"')
	if (!issue || !/^\d+$/.test(issue)) return fail('error: new lesson needs --issue <N>')
	if (!kind || !LESSON_KINDS.includes(kind as (typeof LESSON_KINDS)[number])) return fail(`error: new lesson needs --kind ${LESSON_KINDS.join('|')}`)
	const number = pad(nextLessonNumber(ctx), 4)
	return newRecord(ctx, 'lessons', `${number}-${slugify(title)}.md`, 'lesson.md', { title, number, date: today(), issue, kind })
}

export function nextClaim(ctx: Context, area: string | undefined): Result {
	if (!area) return fail('error: next-claim needs an <area>')
	if (!isDirectory(rootPath(ctx))) return fail(`error: ${rootName(ctx)} is not a directory — run \`init\``)
	const found = readSpec(ctx).areas.find((existing) => existing.name === area)
	if (!found) return fail(`error: no area "${area}" under ${rootName(ctx)}/features`)
	if (!found.prefix || !PREFIX.test(found.prefix)) return fail(`error: ${display(ctx, `features/${area}/README.md`)} declares no valid "prefix:"`)
	return ok(nextClaimId(ctx, found.prefix))
}

export const nextAdr = (ctx: Context): Result => ok(pad(nextAdrNumber(ctx), 4))

// ---------------------------------------------------------------------------
// Coverage

/** A gitignore-style glob as a regular expression over a posix path. */
export function globToRegExp(glob: string): RegExp {
	const escaped = glob
		.replace(/\*\*\//g, '\0')
		.replace(/\*\*/g, '\u0001')
		.replace(/\*/g, '\u0002')
		.replace(/\?/g, '\u0003')
		.replace(/[.+^${}()|[\]\\]/g, '\\$&')
		.replace(/\0/g, '(?:.*/)?')
		.replace(/\u0001/g, '.*')
		.replace(/\u0002/g, '[^/]*')
		.replace(/\u0003/g, '[^/]')
	return new RegExp(`^${escaped}$`)
}

export interface Exemption {
	category: string
	reason: string
	preserved: string[]
}

/** The exemption a pull request body claims, or why what it wrote is not one. */
export function exemption(body: string): { exemption?: Exemption; problem?: string } {
	const match = EXEMPTION.exec(body)
	if (!match) {
		if (ATTEMPTED.test(body)) return { problem: 'the exemption line is `No .feature scenario needed: <category> — <reason>`' }
		return {}
	}
	const [, category, reason] = match
	if (!(category in CATEGORIES)) return { problem: `"${category}" is not an exemption category; one of ${Object.keys(CATEGORIES).join(', ')}` }
	if (reason.trim() === '') return { problem: 'the exemption gives no reason' }
	const preserved = PRESERVED.exec(body)
	if (!preserved) return { problem: 'an exemption cites the claims it preserves: `Claims preserved: REQ-…, REQ-…`' }
	const ids = preserved[1].match(CLAIM_ANY) ?? []
	if (ids.length === 0) return { problem: '`Claims preserved:` names no claim ID' }
	return { exemption: { category, reason: reason.trim(), preserved: unique(ids) } }
}

/** Whether a feature file's diff changes scenario text rather than blank lines or comments. */
function scenarioTextChanged(diff: string): boolean {
	return diff.split('\n').some((line) => {
		if (!/^[+-]/.test(line) || /^(\+\+\+|---)/.test(line)) return false
		const text = line.slice(1).trim()
		return text !== '' && !text.startsWith('#')
	})
}

export function coverage(ctx: Context, base: string | undefined, bodyPath?: string): Result {
	if (!base) return fail('error: coverage needs --base <ref>')
	if (!isDirectory(rootPath(ctx))) return fail(`error: ${rootName(ctx)} is not a directory — run \`init\``)
	const spec = readSpec(ctx)
	if (!spec.areaPaths) return fail(`error: ${display(ctx, 'area-paths.json')} ${spec.areaPathsError ?? 'is missing'}`)
	const names = git(ctx.cwd, ['diff', '--name-only', `${base}...HEAD`])
	if (names === undefined) return fail(`error: git diff ${base}...HEAD failed — is ${base} a ref, and is this the repository root?`)
	const changed = names.split('\n').filter(Boolean)
	const every = spec.areaPaths.every.map(globToRegExp)
	const areaGlobs = Object.entries(spec.areaPaths.areas).map(([area, globs]) => [area, globs.map(globToRegExp)] as const)
	const mapped = new Map<string, string[]>()
	for (const file of changed) {
		const areas = every.some((pattern) => pattern.test(file)) ? areaGlobs.map(([area]) => area) : areaGlobs.filter(([, patterns]) => patterns.some((pattern) => pattern.test(file))).map(([area]) => area)
		for (const area of areas) mapped.set(area, [...(mapped.get(area) ?? []), file])
	}
	if (mapped.size === 0) return ok('coverage: no changed file maps to a feature area; nothing to cover.')
	const featurePattern = new RegExp(`^${spec.name.replace(/[.]/g, '\\.')}/features/([^/]+)/\\1\\.feature$`)
	const changedScenarios = new Set<string>()
	for (const file of changed) {
		const match = featurePattern.exec(file)
		if (match && scenarioTextChanged(git(ctx.cwd, ['diff', `${base}...HEAD`, '--', file]) ?? '')) changedScenarios.add(match[1])
	}
	const covered = [...mapped.keys()].filter((area) => changedScenarios.has(area))
	if (covered.length > 0) return ok(`coverage: scenario text changed in ${covered.join(', ')}, which the changed code maps to.`)
	const where = [...mapped.entries()].map(([area, files]) => `${area} (${files.join(', ')})`).join('; ')
	const body = bodyPath ? readFileSync(resolve(ctx.cwd, bodyPath), 'utf8') : ''
	const { exemption: claimed, problem } = exemption(body)
	if (problem) return fail(`error: no scenario changed in ${where}, and the exemption is malformed: ${problem}`)
	if (!claimed) return fail(`error: no scenario changed in ${where}. Add or amend a scenario there, or cite the claims the change preserves (see the skill, "Coverage and exemptions").`)
	const known = new Map(spec.claims.map((claim) => [claim.id, claim.area]))
	const problems: string[] = []
	for (const id of claimed.preserved) {
		if (!known.has(id)) problems.push(`${id} is not a claim`)
		else if (!mapped.has(known.get(id)!)) problems.push(`${id} is in ${known.get(id)}, which the changed code does not map to`)
	}
	if (problems.length > 0) return fail(`error: the exemption (${claimed.category}) cites claims that do not cover this change: ${problems.join('; ')}`)
	return ok(`coverage: exempt as ${claimed.category} — ${claimed.reason}; preserves ${claimed.preserved.join(', ')}.`)
}

// ---------------------------------------------------------------------------
// Command line

export const USAGE = `sdd.ts — the spec-driven-development generator and checker

  init --project "<Name>" [--deciders "<names>"]        create the specification directory
  new feature <area> --prefix <AREA> --title "<Title>"   a feature area: .feature, README, area-paths entry
  new page <slug> --prefix <PAGE> --title "<Title>"      a constraint page
  new adr "<title>" [--deciders "<names>"]               a decision record, next number
  new convention "<title>"                               a convention, next number
  new lesson "<title>" --issue <N> --kind <kind>         a lesson: product, process, or incident
  next-claim <area>                                      the next unused claim ID for the area
  next-adr                                               the next unused ADR number
  generate [--check]                                     write README.md, traceability.md, claims.json
                                                         (init and every new … command also run it)
  check                                                  every structural rule
  coverage --base <ref> [--body <file>]                  a pull request's scenario coverage

Every command takes --root <dir> (default ${DEFAULT_ROOT}) and runs from the repository root.`

export interface Arguments {
	positional: string[]
	flags: Record<string, string | true>
}

/** Flags that are present or absent, never followed by a value. */
const BOOLEAN_FLAGS: ReadonlySet<string> = new Set(['check', 'help'])

export function parseArguments(argv: readonly string[]): Arguments {
	const positional: string[] = []
	const flags: Record<string, string | true> = {}
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index]
		if (argument.startsWith('--')) {
			const next = argv[index + 1]
			if (!BOOLEAN_FLAGS.has(argument.slice(2)) && next !== undefined && !next.startsWith('--')) {
				flags[argument.slice(2)] = next
				index += 1
			} else flags[argument.slice(2)] = true
		} else positional.push(argument)
	}
	return { positional, flags }
}

const text = (value: string | true | undefined): string | undefined => (typeof value === 'string' ? value : undefined)

export function run(argv: readonly string[], cwd: string): Result {
	const { positional, flags } = parseArguments(argv)
	const ctx: Context = { cwd, root: text(flags.root) ?? DEFAULT_ROOT }
	const [command, ...rest] = positional
	/** Refuses a positional argument the command does not take. */
	const only = (count: number, result: () => Result): Result => (rest.length > count ? fail(`error: ${command} does not take "${rest[count]}"\n${USAGE}`) : result())
	try {
		switch (command) {
			case undefined:
			case 'help':
				return ok(USAGE)
			case 'init':
				return only(0, () => init(ctx, { project: text(flags.project), deciders: text(flags.deciders) }))
			case 'new':
				switch (rest[0]) {
					case 'feature':
						return only(2, () => newFeature(ctx, rest[1], text(flags.prefix), text(flags.title)))
					case 'page':
						return only(2, () => newPage(ctx, rest[1], text(flags.prefix), text(flags.title)))
					case 'adr':
						return only(2, () => newAdr(ctx, rest[1], text(flags.deciders)))
					case 'convention':
						return only(2, () => newConvention(ctx, rest[1]))
					case 'lesson':
						return only(2, () => newLesson(ctx, rest[1], text(flags.issue), text(flags.kind)))
					default:
						return fail(`error: new what? feature, page, adr, convention, or lesson\n${USAGE}`)
				}
			case 'next-claim':
				return only(1, () => nextClaim(ctx, rest[0]))
			case 'next-adr':
				return only(0, () => nextAdr(ctx))
			case 'generate':
				return only(0, () => generate(ctx, { check: 'check' in flags }))
			case 'check':
				return only(0, () => check(ctx))
			case 'coverage':
				return only(0, () => coverage(ctx, text(flags.base), text(flags.body)))
			default:
				return fail(`error: unknown command "${command}"\n${USAGE}`)
		}
	} catch (error) {
		return fail(`error: ${(error as Error).message}`)
	}
}

export function main(argv: readonly string[] = process.argv.slice(2), cwd: string = process.cwd()): number {
	const result = flags(argv) ? ok(USAGE) : run(argv, cwd)
	for (const line of result.output) console.log(line)
	for (const line of result.errors) console.error(line)
	return result.code
}

const flags = (argv: readonly string[]): boolean => argv.includes('--help') || argv.includes('-h')

const isMain = process.argv[1] !== undefined && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) process.exit(main())
