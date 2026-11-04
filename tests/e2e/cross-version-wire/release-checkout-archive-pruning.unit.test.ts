import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { commitRelease } from './release-checkout-git-fixture.test-fixture'
import { extractReleaseCheckoutTree } from './release-checkout-tree'
import { withReleaseArchivePruning } from './release-checkout-archive-pruning.ts'

const directories: string[] = []
afterEach(async () => {
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

it('preserves global attributes and removes the private file after an archive error', async () => {
  const root = await mkdtemp(join(tmpdir(), 'archive-pruning-test-'))
  directories.push(root)
  const original = join(root, 'global')
  await writeFile(original, 'src/keep.ts export-ignore\n')
  let temp = ''
  const failure = new Error('archive failed')
  await expect(
    withReleaseArchivePruning(
      root,
      'revision',
      ['src'],
      async (args) => {
        if (args[0] === 'ls-tree') {
          return '100644 blob abc\tsrc/a[1].test.ts\0' + '120000 blob abc\tsrc/link.test.ts\0'
        }
        return `${original}\0`
      },
      async (config) => {
        temp = config[1].slice('core.attributesFile='.length)
        const attributes = await readFile(temp, 'utf8')
        expect(attributes).toContain('src/keep.ts export-ignore')
        expect(attributes).toContain('a\\\\[1\\\\].test.ts')
        expect(attributes).not.toContain('link.test.ts')
        throw failure
      }
    )
  ).rejects.toBe(failure)
  await expect(readFile(temp)).rejects.toThrow()
  expect(await readdir(root)).toEqual(['global'])
})

it('falls back once when metadata cannot be parsed', async () => {
  let calls = 0
  await withReleaseArchivePruning(
    '.',
    'revision',
    ['src'],
    async () => 'bad metadata\0',
    async (config) => {
      calls++
      expect(config).toEqual([])
    }
  )
  expect(calls).toBe(1)
})

it('cleans its private attributes after successful archiving', async () => {
  let temporary = ''
  await withReleaseArchivePruning(
    '.',
    'revision',
    ['src'],
    async (args) => {
      if (args[0] === 'ls-tree') {
        return '100755 blob abc\tsrc/run.spec.js\0'
      }
      return '\0'
    },
    async (config) => {
      temporary = config[1].slice('core.attributesFile='.length)
      expect(await readFile(temporary, 'utf8')).toContain('/src/run.spec.js')
    }
  )
  await expect(readFile(temporary)).rejects.toThrow()
})

it('archives once without pruning if existing global attributes cannot be read', async () => {
  let calls = 0
  await withReleaseArchivePruning(
    '.',
    'revision',
    ['src'],
    async (args) => {
      if (args[0] === 'ls-tree') {
        return '100644 blob abc\tsrc/run.test.ts\0'
      }
      return `${tmpdir()}\0`
    },
    async (config) => {
      calls++
      expect(config).toEqual([])
    }
  )
  expect(calls).toBe(1)
})

const staleMetadata = Array.from(
  { length: 64 },
  (_, index) => `100644 blob abc\tsrc/stale-${index}.test.ts\0`
).join('')

it('keeps archived native workspace files outside the prepared roots', async () => {
  const root = await mkdtemp(join(tmpdir(), 'archive-native-fidelity-'))
  directories.push(root)
  const { repo, commit } = commitRelease((prefix) => mkdtempSync(join(root, prefix)), {
    'pnpm-workspace.yaml': 'packages:\n  - native/compat/*\n',
    'native/compat/pkg/package.json': JSON.stringify({
      name: '@fixture/native',
      exports: { '.': { 'orca-source': './index.ts', default: './index.ts' } }
    }),
    'native/compat/pkg/index.ts': 'export const native = true\n',
    'native/compat/pkg/preserve.test.ts': 'native bytes\n',
    ...Object.fromEntries(
      Array.from({ length: 64 }, (_, index) => [`src/stale-${index}.test.ts`, 'stale\n'])
    )
  })
  const staging = mkdtempSync(join(root, 'staging-'))
  await extractReleaseCheckoutTree(repo, staging, commit, true)
  expect(await readFile(join(staging, 'native/compat/pkg/preserve.test.ts'), 'utf8')).toBe(
    'native bytes\n'
  )
  expect(await readFile(join(staging, 'native/compat/pkg/index.ts'), 'utf8')).toBe(
    'export const native = true\n'
  )
  expect(
    JSON.parse(await readFile(join(staging, 'native/compat/pkg/package.json'), 'utf8')).name
  ).toBe('@fixture/native')
})

it('bounds the attribute rule budget for a large safe inventory', async () => {
  await withReleaseArchivePruning(
    '.',
    'revision',
    ['src'],
    async (args) => (args[0] === 'ls-tree' ? staleMetadata : '\0'),
    async (config) => {
      const attributes = await readFile(config[1].slice('core.attributesFile='.length), 'utf8')
      expect(
        attributes.split('\n').filter((line) => line.endsWith(' export-ignore')).length
      ).toBeLessThanOrEqual(21)
    }
  )
})

it.each([
  ['120000 blob abc\tsrc/link.test.ts\0', 'src/link.test.ts'],
  ['040000 tree abc\tsrc/folder.test.ts\0', 'src/folder.test.ts']
])('does not ignore protected metadata path %s', async (protectedMetadata, protectedPath) => {
  const root = await mkdtemp(join(tmpdir(), 'archive-protected-'))
  directories.push(root)
  execFileSync('git', ['init', '--quiet'], { cwd: root })
  await withReleaseArchivePruning(
    root,
    'revision',
    ['src'],
    async (args) => (args[0] === 'ls-tree' ? staleMetadata + protectedMetadata : '\0'),
    async (config) => {
      const result = execFileSync(
        'git',
        [...config, 'check-attr', '-z', 'export-ignore', '--', protectedPath],
        {
          cwd: root,
          encoding: 'utf8'
        }
      )
      expect(result.split('\0')[2]).toBe('unspecified')
    }
  )
})
