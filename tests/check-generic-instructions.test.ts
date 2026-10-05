import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { checkText, instructionFiles, main, missingSkillFiles } from '../tools/check-generic-instructions.ts'

test('GivenGenericText_WhenChecked_ThenNoProblems', () => {
	assert.deepEqual(checkText('agents/x.md', 'Keep the design direct.\nThe worker is a plain noun; a test reporter is fine.\n'), [])
})

test('GivenProductName_WhenChecked_ThenReportsLine', () => {
	const problems = checkText('agents/x.md', 'ok\nHPAC rules\n')
	assert.equal(problems.length, 1)
	assert.match(problems[0], /^agents\/x\.md:2: names a product/)
})

test('GivenRecordReferences_WhenChecked_ThenEachIsReported', () => {
	for (const text of ['see ADR-0147', 'see ADR 0147', 'CONV-008', 'REQ-SUB-013', 'lesson 0043', 'in .spec/features', 'docs/decisions/x']) {
		assert.ok(checkText('a.md', text).length > 0, text)
	}
})

test('GivenReferenceWrappedAcrossLines_WhenChecked_ThenCaught', () => {
	assert.equal(checkText('a.md', 'see ADR\n0147 for why').length, 1)
})

test('GivenTestSpecFile_WhenChecked_ThenNotASpecPath', () => {
	assert.deepEqual(checkText('a.md', 'run foo.spec.ts'), [])
})

test('GivenSkillDirWithoutExactSkillMd_WhenChecked_ThenReported', () => {
	const root = mkdtempSync(join(tmpdir(), 'gi-'))
	mkdirSync(join(root, 'skills/a'), { recursive: true })
	mkdirSync(join(root, 'agents'))
	writeFileSync(join(root, 'skills/a/skill.md'), 'x')
	writeFileSync(join(root, 'agents/x.md'), 'clean')
	assert.deepEqual(missingSkillFiles(root), ['skills/a/SKILL.md'])
	assert.equal(main(root), 1)
})

test('GivenCleanTree_WhenMainRuns_ThenZero', () => {
	const root = mkdtempSync(join(tmpdir(), 'gi-'))
	mkdirSync(join(root, 'skills/a'), { recursive: true })
	writeFileSync(join(root, 'skills/a/SKILL.md'), 'clean')
	writeFileSync(join(root, 'skills/a/notes.bin'), 'HPAC')
	assert.deepEqual(instructionFiles(root), ['skills/a/SKILL.md'])
	assert.equal(main(root), 0)
})
