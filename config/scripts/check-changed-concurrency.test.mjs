import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test, vi } from 'vitest'
import { resolveCheckConcurrency } from './check-changed-concurrency.mjs'

test('default pool retains the old CPU policy and maxWorkers caps it', () => {
  assert.equal(resolveCheckConcurrency({ parallelism: 24 }), 8)
  assert.equal(resolveCheckConcurrency({ parallelism: 2 }), 3)
  assert.equal(resolveCheckConcurrency({ parallelism: 24, maxWorkers: 2 }), 2)
  assert.equal(resolveCheckConcurrency({ parallelism: 24, maxWorkers: 20 }), 8)
  assert.equal(resolveCheckConcurrency({ parallelism: 24, maxWorkers: 0 }), 8)
})

test('explicit check concurrency overrides both automatic and worker limits', () => {
  assert.equal(resolveCheckConcurrency({ parallelism: 24, maxWorkers: 2, checkConcurrency: 5 }), 5)
})

test('CLI rejects invalid check concurrency before running the gate', () => {
  for (const value of ['-1', '0', '1.5', 'NaN', 'Infinity', '']) {
    const result = spawnSync(
      process.execPath,
      ['config/scripts/check-changed.mjs', `--checkConcurrency=${value}`],
      {
        encoding: 'utf8',
        windowsHide: true,
        env: { ...process.env, ORCA_BACKGROUND_LAUNCH: '1' }
      }
    )
    assert.equal(result.status, 1, value)
    assert.match(result.stderr, /checkConcurrency.*positive integer/i, value)
  }
})

test('valid CLI concurrency override reaches the scheduler and runs each check once', async () => {
  const previousLogDir = process.env.ORCA_CHECK_CHANGED_LOG_DIR
  delete process.env.ORCA_CHECK_CHANGED_LOG_DIR
  const checks = ['first', 'second', 'third', 'fourth']
  let active = 0
  let peak = 0
  const completed = []

  vi.doMock('./check-changed-pass-cache.mjs', () => ({
    collectChangedFiles: () => ['changed.js'],
    computePassHash: () => 'hash',
    readPassHash: () => null,
    writePassHash: () => {}
  }))
  vi.doMock('./check-changed-selection.mjs', () => ({
    planChangedChecks: () => ({
      typecheckProjects: [],
      unitTests: { related: [], colocated: [] },
      staticAnalysis: false,
      checks: checks.map((name) => ({ name, args: [name] }))
    })
  }))
  vi.doMock('@orca/process-host', () => ({
    runProcess: async ({ args }) => {
      active += 1
      peak = Math.max(peak, active)
      await Promise.resolve()
      completed.push(args[0])
      active -= 1
      return { code: 0, timedOut: false, stdout: '', stderr: '' }
    },
    runProcessSync: () => {}
  }))
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})
  try {
    const { main } = await import('./check-changed.mjs')
    const result = await main(process.cwd(), [
      '--force',
      '--base=HEAD',
      '--maxWorkers=1',
      '--checkConcurrency=2'
    ])
    assert.equal(result, 0)
    assert.equal(peak, 2)
    assert.equal(active, 0)
    assert.deepEqual(completed.sort(), [...checks].sort())
  } finally {
    if (previousLogDir === undefined) {
      delete process.env.ORCA_CHECK_CHANGED_LOG_DIR
    } else {
      process.env.ORCA_CHECK_CHANGED_LOG_DIR = previousLogDir
    }
    log.mockRestore()
    vi.doUnmock('./check-changed-pass-cache.mjs')
    vi.doUnmock('./check-changed-selection.mjs')
    vi.doUnmock('@orca/process-host')
    vi.resetModules()
  }
})

test('retains long task output privately while console shows only the tail', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'gate-log-'))
  const logDir = path.join(dir, 'logs')
  const previousLogDir = process.env.ORCA_CHECK_CHANGED_LOG_DIR
  process.env.ORCA_CHECK_CHANGED_LOG_DIR = logDir
  const completed = []
  vi.doMock('./check-changed-pass-cache.mjs', () => ({
    collectChangedFiles: () => ['changed.js'],
    computePassHash: () => 'hash',
    readPassHash: () => null,
    writePassHash: () => {}
  }))
  vi.doMock('./check-changed-selection.mjs', () => ({
    planChangedChecks: () => ({
      typecheckProjects: [],
      unitTests: { related: [], colocated: [] },
      staticAnalysis: false,
      checks: ['unit tests', 'other'].map((name) => ({ name, args: [name] }))
    })
  }))
  vi.doMock('@orca/process-host', () => ({
    runProcess: async ({ args }) => {
      completed.push(args[0])
      return args[0] === 'unit tests'
        ? {
            code: 1,
            timedOut: false,
            stdout: Array.from({ length: 250 }, (_, i) => `line-${i}\n`).join(''),
            stderr: 'stderr-marker\n'
          }
        : { code: 0, timedOut: false, stdout: 'other-output', stderr: '' }
    },
    runProcessSync: () => {}
  }))
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    const { main } = await import('./check-changed.mjs')
    assert.equal(await main(process.cwd(), ['--force', '--base=HEAD', '--checkConcurrency=2']), 1)
    const output = readFileSync(path.join(logDir, 'unit-tests.log'), 'utf8')
    assert.match(output, /line-0\n/)
    assert.match(output, /line-249\nstderr-marker/)
    assert.doesNotMatch(error.mock.calls.flat().join('\n'), /line-0\n/)
    assert.match(error.mock.calls.flat().join('\n'), /earlier lines omitted/)
    if (process.platform !== 'win32') {
      assert.equal(statSync(logDir).mode & 0o777, 0o700)
      assert.equal(statSync(path.join(logDir, 'unit-tests.log')).mode & 0o777, 0o600)
    }
    assert.deepEqual(completed.sort(), ['other', 'unit tests'])
  } finally {
    if (previousLogDir === undefined) {
      delete process.env.ORCA_CHECK_CHANGED_LOG_DIR
    } else {
      process.env.ORCA_CHECK_CHANGED_LOG_DIR = previousLogDir
    }
    log.mockRestore()
    error.mockRestore()
    vi.doUnmock('./check-changed-pass-cache.mjs')
    vi.doUnmock('./check-changed-selection.mjs')
    vi.doUnmock('@orca/process-host')
    vi.resetModules()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('diagnostic write errors warn and do not change the verdict or stop the queue', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'gate-log-error-'))
  const badDir = path.join(dir, 'file')
  writeFileSync(badDir, 'occupied')
  const previousLogDir = process.env.ORCA_CHECK_CHANGED_LOG_DIR
  process.env.ORCA_CHECK_CHANGED_LOG_DIR = badDir
  const completed = []
  vi.doMock('./check-changed-pass-cache.mjs', () => ({
    collectChangedFiles: () => ['changed.js'],
    computePassHash: () => 'hash',
    readPassHash: () => null,
    writePassHash: () => {}
  }))
  vi.doMock('./check-changed-selection.mjs', () => ({
    planChangedChecks: () => ({
      typecheckProjects: [],
      unitTests: { related: [], colocated: [] },
      staticAnalysis: false,
      checks: ['first', 'second'].map((name) => ({ name, args: [name] }))
    })
  }))
  vi.doMock('@orca/process-host', () => ({
    runProcess: async ({ args }) => {
      completed.push(args[0])
      return { code: 0, timedOut: false, stdout: 'output', stderr: '' }
    },
    runProcessSync: () => {}
  }))
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  try {
    const { main } = await import('./check-changed.mjs')
    assert.equal(await main(process.cwd(), ['--force', '--base=HEAD', '--checkConcurrency=1']), 0)
    assert.deepEqual(completed, ['first', 'second'])
    assert.ok(warn.mock.calls.length > 0)
  } finally {
    if (previousLogDir === undefined) {
      delete process.env.ORCA_CHECK_CHANGED_LOG_DIR
    } else {
      process.env.ORCA_CHECK_CHANGED_LOG_DIR = previousLogDir
    }
    log.mockRestore()
    warn.mockRestore()
    vi.doUnmock('./check-changed-pass-cache.mjs')
    vi.doUnmock('./check-changed-selection.mjs')
    vi.doUnmock('@orca/process-host')
    vi.resetModules()
    rmSync(dir, { recursive: true, force: true })
  }
})
