import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
  chmodSync,
  lstatSync,
  readlinkSync,
  symlinkSync
} from 'node:fs'
import type * as FsPromises from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as currentProcessHost from '@orca/process-host'
import { importReleaseCheckoutModule } from './release-checkout'
import { extractReleaseCheckoutTree } from './release-checkout-tree'
import { commitRelease as createRelease } from './release-checkout-git-fixture.test-fixture'

const reads = vi.hoisted<{
  archive: string[] | undefined
  active: number
  peak: number
  fail: boolean
  failed: boolean
  onRead: ((path: string) => Promise<void>) | undefined
  onWrite: ((path: string, write: () => Promise<void>) => Promise<void>) | undefined
}>(() => ({
  archive: undefined,
  active: 0,
  peak: 0,
  fail: false,
  failed: false,
  onRead: undefined,
  onWrite: undefined
}))

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof FsPromises>()
  const readFile = async (...args: Parameters<typeof actual.readFile>) => {
    if (!String(args[0]).replaceAll('\\', '/').includes('/concurrent-fixture-')) {
      return actual.readFile(...args)
    }
    await reads.onRead?.(String(args[0]))
    reads.active++
    reads.peak = Math.max(reads.peak, reads.active)
    try {
      if (reads.fail && !reads.failed) {
        reads.failed = true
        await Promise.resolve()
        await actual.readFile(...args)
        throw new Error('controlled fixture read failure')
      }
      return await actual.readFile(...args)
    } finally {
      reads.active--
    }
  }
  const writeFile = async (...args: Parameters<typeof actual.writeFile>) => {
    const write = async () => {
      await actual.writeFile(...args)
    }
    if (reads.onWrite) {
      return reads.onWrite(String(args[0]), write)
    }
    return write()
  }
  const rm = async (...args: Parameters<typeof actual.rm>) => {
    const path = String(args[0])
    if (path.endsWith('.release-checkout.tar') && existsSync(path)) {
      try {
        const tar =
          process.platform === 'win32'
            ? join(
                process.env.SystemRoot ?? process.env.SYSTEMROOT ?? 'C:\\Windows',
                'System32',
                'tar.exe'
              )
            : 'tar'
        reads.archive = execFileSync(tar, ['-tf', path], { encoding: 'utf8' }).split('\n')
      } catch {
        reads.archive = undefined
      }
    }
    return actual.rm(...args)
  }
  return { ...actual, readFile, writeFile, rm }
})

const temporaryRoots: string[] = []

afterEach(() => {
  reads.archive = undefined
  reads.active = 0
  reads.peak = 0
  reads.fail = false
  reads.failed = false
  reads.onRead = undefined
  reads.onWrite = undefined
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

function temporaryDirectory(prefix: string): string {
  // Why realpath: vite reports module urls through macOS's /var -> /private/var symlink.
  const root = realpathSync(mkdtempSync(join(tmpdir(), prefix)))
  temporaryRoots.push(root)
  return root
}

const commitRelease = (files: Record<string, string>, setup?: (repo: string) => void) =>
  createRelease(temporaryDirectory, files, setup)

const RELEASE_PROCESS_HOST = {
  'src/packages/process-host/package.json': JSON.stringify({
    name: '@orca/process-host',
    type: 'commonjs',
    exports: {
      '.': { 'orca-source': './src/run-process.ts', default: './dist/run-process.js' },
      './process-spec': {
        'orca-source': './src/process-spec.ts',
        default: './dist/process-spec.js'
      }
    }
  }),
  'src/packages/process-host/src/run-process.ts': [
    "import { describeSpec } from './process-spec'",
    "export const runProcess = () => 'release runProcess'",
    'export const releaseOnlyExport = describeSpec',
    ''
  ].join('\n'),
  'src/packages/process-host/src/process-spec.ts':
    "export const describeSpec = () => 'release process-spec'\n",
  'src/packages/process-host/src/run-process.test.ts': 'throw new Error("stale spec")\n',
  'src/packages/release-tool/package.json': JSON.stringify({
    name: '@orca/release-tool',
    type: 'module',
    exports: {
      '.': { 'orca-source': './src/index.mjs', default: './dist/index.js' },
      './private': { default: './dist/private.js' }
    }
  }),
  'src/packages/release-tool/src/index.mjs':
    "import { runProcess } from '@orca/process-host'\nexport const tool = () => `tool:${runProcess()}`\n",
  'src/packages/release-tool/src/index.test.mjs': 'throw new Error("stale spec")\n'
}

function concurrentFixture(): Record<string, string> {
  return Object.fromEntries(
    Array.from({ length: 32 }, (_, index) => [
      `src/renderer/src/concurrent-fixture-${String(index).padStart(2, '0')}.ts`,
      `import { name${index} } from 'external-package-${index % 3}'\n` +
        "import { label } from '@/lib/label'\n" +
        "import { runProcess } from '@orca/process-host'\n" +
        `export { name${index}, label, runProcess }\n`
    ])
  )
}

describe('release checkout source preparation', () => {
  it('bounds concurrent reads while preserving rewrites and every imported name', async () => {
    const files = concurrentFixture()
    const { repo, commit } = commitRelease({
      'pnpm-workspace.yaml': 'packages:\n  - src/packages/*\n',
      ...RELEASE_PROCESS_HOST,
      ...files,
      'src/renderer/src/lib/label.ts': "export const label = 'renderer'\n",
      'src/renderer/src/stale.test.ts': 'throw new Error("stale")\n'
    })
    const staging = temporaryDirectory('orca-cross-version-release-staging-')

    const imports = await extractReleaseCheckoutTree(repo, staging, commit, true)

    for (let packageIndex = 0; packageIndex < 3; packageIndex++) {
      const expected = Array.from({ length: 32 }, (_, index) => index)
        .filter((index) => index % 3 === packageIndex)
        .map((index) => `name${index}`)
        .sort()
      expect([...imports.get(`external-package-${packageIndex}`)!].sort()).toEqual(expected)
    }
    for (const path of Object.keys(files)) {
      const source = readFileSync(join(staging, path), 'utf8')
      expect(source).toContain("from './lib/label'")
      expect(source).toContain("from '../../packages/process-host/src/run-process.ts'")
    }
    expect(existsSync(join(staging, 'src/renderer/src/stale.test.ts'))).toBe(false)
    expect(reads.active).toBe(0)
    expect(reads.peak).toBeGreaterThan(1)
    expect(reads.peak).toBeLessThanOrEqual(16)
  })

  it('waits for in-flight writes and stops dequeuing after a read failure', async () => {
    const { repo, commit } = commitRelease(concurrentFixture())
    const staging = temporaryDirectory('orca-cross-version-release-staging-')
    const deferred = () => {
      let resolve!: () => void
      const promise = new Promise<void>((done) => {
        resolve = done
      })
      return { promise, resolve }
    }
    const batch = deferred()
    const fail = deferred()
    const writesReady = deferred()
    const releaseWrites = deferred()
    const releaseLast = deferred()
    const releasedWritesDone = deferred()
    const failure = new Error('controlled fixture failure')
    let started = 0
    let activeWrites = 0
    let writes = 0
    reads.onRead = async () => {
      const index = started++
      if (index === 15) {
        batch.resolve()
      }
      if (index === 0) {
        await fail.promise
        throw failure
      }
    }
    reads.onWrite = async (path, write) => {
      if (!path.replaceAll('\\', '/').includes('/concurrent-fixture-')) {
        return write()
      }
      const index = writes++
      activeWrites++
      if (writes === 15) {
        writesReady.resolve()
      }
      try {
        await (index === 0 ? releaseLast.promise : releaseWrites.promise)
        await write()
      } finally {
        activeWrites--
        if (activeWrites === 1 && writes === 15) {
          releasedWritesDone.resolve()
        }
      }
    }
    let settled = false
    const extraction = extractReleaseCheckoutTree(repo, staging, commit, true).then(
      () => {
        settled = true
        return undefined
      },
      (error: unknown) => {
        settled = true
        return error
      }
    )
    try {
      await batch.promise
      await writesReady.promise
      fail.resolve()
      releaseWrites.resolve()
      await releasedWritesDone.promise
      expect(settled).toBe(false)
    } finally {
      releaseWrites.resolve()
      releaseLast.resolve()
    }
    expect(await extraction).toBe(failure)
    expect(activeWrites).toBe(0)
    expect(started).toBe(16)
  })
})

describe('release checkout workspace packages', () => {
  it('loads the release workspace package rather than the current one', async () => {
    expect('releaseOnlyExport' in currentProcessHost).toBe(false)
    const { repo, commit } = commitRelease({
      'pnpm-workspace.yaml': "packages:\n  - src/packages/*\n  - '!src/packages/ignored'\n",
      ...RELEASE_PROCESS_HOST,
      'src/main/consumer.ts': [
        "import { runProcess, releaseOnlyExport } from '@orca/process-host'",
        "import * as spec from '@orca/process-host/process-spec'",
        'export { describeSpec as reexported } from "@orca/process-host/process-spec"',
        'export const staticRun = runProcess()',
        'export const releaseOnly = releaseOnlyExport()',
        'export const specValue = spec.describeSpec()',
        "export const lazyRun = async () => (await import('@orca/process-host')).runProcess()",
        ''
      ].join('\n'),
      'src/main/esm-consumer.mjs': [
        "import { describeSpec } from '@orca/process-host/process-spec'",
        "import { tool } from '@orca/release-tool'",
        'export const esm = `${describeSpec()}|${tool()}`',
        ''
      ].join('\n'),
      'src/main/commonjs-consumer.cjs':
        "module.exports = () => require('@orca/process-host/process-spec')\n",
      'src/renderer/src/lib/view.ts': [
        "import { label } from '@/lib/label'",
        "export const view = async () => `${label}:${(await import('@orca/process-host')).runProcess()}`",
        ''
      ].join('\n'),
      'src/renderer/src/lib/label.ts': "export const label = 'renderer'\n"
    })
    const staging = temporaryDirectory('orca-cross-version-release-staging-')

    await extractReleaseCheckoutTree(repo, staging, commit)
    const checkout = { ref: 'v0.0.0-synthetic', commit, label: 'v0.0.0-synthetic', root: staging }
    const consumer = await importReleaseCheckoutModule(checkout, '/src/main/consumer.ts')
    const view = await importReleaseCheckoutModule(checkout, '/src/renderer/src/lib/view.ts')
    const esm = await importReleaseCheckoutModule(checkout, '/src/main/esm-consumer.mjs')
    const call = async (module: Record<string, unknown>, name: string): Promise<unknown> => {
      const exported = module[name]
      if (typeof exported !== 'function') {
        throw new Error(`synthetic release has no ${name} export`)
      }
      return exported()
    }

    expect(consumer.staticRun).toBe('release runProcess')
    expect(consumer.releaseOnly).toBe('release process-spec')
    expect(consumer.specValue).toBe('release process-spec')
    expect(await call(consumer, 'reexported')).toBe('release process-spec')
    expect(await call(consumer, 'lazyRun')).toBe('release runProcess')
    expect(await call(view, 'view')).toBe('renderer:release runProcess')
    expect(esm.esm).toBe('release process-spec|tool:release runProcess')
    expect(readFileSync(join(staging, 'src/main/commonjs-consumer.cjs'), 'utf8')).toContain(
      "require('../packages/process-host/src/process-spec.ts')"
    )
    expect(existsSync(join(staging, 'src/packages/process-host/src/run-process.test.ts'))).toBe(
      false
    )
    expect(existsSync(join(staging, 'src/packages/release-tool/src/index.test.mjs'))).toBe(false)
    expect(existsSync(join(staging, 'node_modules'))).toBe(false)
  })

  it.each(['@orca/process-host/internal', '@orca/release-tool/private', '@orca/not-in-release'])(
    'fails extraction rather than loading the current tree for %s',
    async (specifier) => {
      const { repo, commit } = commitRelease({
        'pnpm-workspace.yaml': 'packages:\n  - src/packages/*\n',
        ...RELEASE_PROCESS_HOST,
        'src/main/private.ts': `import { x } from '${specifier}'\nexport { x }\n`
      })
      const staging = temporaryDirectory('orca-cross-version-release-staging-')

      const failure = await extractReleaseCheckoutTree(repo, staging, commit).then(
        () => null,
        (error: unknown) => String(error)
      )

      expect(failure).toMatch(/src[/\\]main[/\\]private\.ts: /)
      expect(failure).toContain(`No public orca-source export for ${specifier}`)
    }
  )
})
describe('release archive pruning', () => {
  it('omits regular stale tests while preserving archive attributes and the final tree', async () => {
    const attrs = temporaryDirectory('orca-attributes-')
    const globalAttributes = join(attrs, 'attributes')
    const attributes = 'src/main/hidden.ts export-ignore\n'
    writeFileSync(globalAttributes, attributes)
    const { repo, commit } = commitRelease(
      {
        'src/main/stale.test.ts': 'stale\n',
        'src/main/space [é].test.ts': 'stale too\n',
        'src/main/override.test.ts': 'override\n',
        'src/main/empty.test.ts/only.spec.ts': 'stale\n',
        'src/main/folder.test.ts/keep.txt': 'directory source\n',
        'src/main/keep.txt': 'exact bytes\n',
        'src/main/hidden.ts': 'hidden\n',
        'src/main/.gitattributes': 'override.test.ts -export-ignore\n'
      },
      (root) => {
        execFileSync('git', ['config', 'core.attributesFile', globalAttributes], { cwd: root })
        if (process.platform !== 'win32') {
          chmodSync(join(root, 'src/main/keep.txt'), 0o755)
          symlinkSync('keep.txt', join(root, 'src/main/link.test.ts'))
        }
      }
    )
    const staging = temporaryDirectory('orca-cross-version-release-staging-')
    await extractReleaseCheckoutTree(repo, staging, commit, true)
    expect(readFileSync(join(staging, 'src/main/keep.txt'), 'utf8')).toBe('exact bytes\n')
    expect(readFileSync(join(staging, 'src/main/folder.test.ts/keep.txt'), 'utf8')).toBe(
      'directory source\n'
    )
    expect(existsSync(join(staging, 'src/main/hidden.ts'))).toBe(false)
    expect(existsSync(join(staging, 'src/main/override.test.ts'))).toBe(false)
    expect(existsSync(join(staging, 'src/main/empty.test.ts'))).toBe(true)
    expect(readFileSync(globalAttributes, 'utf8')).toBe(attributes)
    if (process.platform !== 'win32') {
      expect(lstatSync(join(staging, 'src/main/keep.txt')).mode & 0o111).not.toBe(0)
      expect(readlinkSync(join(staging, 'src/main/link.test.ts'))).toBe('keep.txt')
    }
    expect(reads.archive).toBeDefined()
    expect(reads.archive).toContain('src/main/override.test.ts')
    expect(reads.archive).not.toContain('src/main/stale.test.ts')
    expect(reads.archive).not.toContain('src/main/space [é].test.ts')
  })
})
