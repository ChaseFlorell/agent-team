import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/** The nth `command: |` block scalar in an agent file (a PreToolUse hook), dedented. */
export function hookScript(path: string, nth = 0): string {
	const lines = readFileSync(path, 'utf8').split('\n')
	const opens = lines.flatMap((line, i) => (/^\s*command:\s*\|[+-]?\s*$/.test(line) ? [i] : []))
	assert.ok(nth < opens.length, `${path} has no \`command: |\` hook block #${nth}`)
	const open = opens[nth]
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
