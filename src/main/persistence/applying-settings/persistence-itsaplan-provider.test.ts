import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  closeTestStores,
  createStore,
  readDataFile,
  testState,
  writeDataFile
} from '../persistence-test-harness'

vi.mock('../../ssh/config/ssh-config-parser', () => ({
  loadUserSshConfig: vi.fn(),
  sshConfigHostsToTargets: vi.fn()
}))
vi.mock('../../telemetry/client', () => ({ track: vi.fn() }))
vi.mock('../../telemetry/cohort-classifier', () => ({ getCohortAtEmit: vi.fn() }))

function seed(settings: Record<string, unknown>) {
  writeDataFile({
    schemaVersion: 1,
    repos: [],
    worktreeMeta: {},
    settings,
    ui: {},
    githubCache: { pr: {}, issue: {} },
    workspaceSession: {}
  })
}

describe('Itsaplan provider visibility migration', () => {
  beforeEach(() => {
    testState.dir = mkdtempSync(join(tmpdir(), 'orca-itsaplan-provider-'))
  })
  afterEach(async () => {
    await closeTestStores()
    rmSync(testState.dir, { recursive: true, force: true })
  })

  it('offers Itsaplan once to an older profile while retaining its chosen source and hidden providers', () => {
    seed({
      visibleTaskProviders: ['linear'],
      defaultTaskSource: 'linear',
      visibleTaskProvidersDefaultedForJira: true,
      visibleTaskProvidersDefaultedForItsaplan: false
    })
    const store = createStore()
    expect(store.getSettings().visibleTaskProviders).toEqual(['linear', 'itsaplan'])
    expect(store.getSettings().defaultTaskSource).toBe('linear')
    expect(store.getSettings().visibleTaskProvidersDefaultedForItsaplan).toBe(true)
    store.flush()
    expect(readDataFile()).toMatchObject({
      settings: {
        visibleTaskProvidersDefaultedForItsaplan: true,
        visibleTaskProviders: ['linear', 'itsaplan']
      }
    })
  })

  it('keeps an intentional Itsaplan hide through saving and reopening the profile', async () => {
    seed({
      visibleTaskProviders: ['jira'],
      defaultTaskSource: 'jira',
      visibleTaskProvidersDefaultedForJira: true
    })
    const store = createStore()
    expect(store.getSettings().visibleTaskProviders).toEqual(['jira', 'itsaplan'])
    store.updateSettings({ visibleTaskProviders: ['jira'] })
    store.flush()
    await closeTestStores()
    const reopened = createStore()
    expect(reopened.getSettings().visibleTaskProviders).toEqual(['jira'])
    expect(reopened.getSettings().visibleTaskProvidersDefaultedForItsaplan).toBe(true)
  })

  it('repairs an empty provider list to all supported sources without duplicating Itsaplan', () => {
    seed({ visibleTaskProviders: [], defaultTaskSource: 'itsaplan' })
    const store = createStore()
    expect(store.getSettings().visibleTaskProviders).toEqual([
      'github',
      'gitlab',
      'linear',
      'jira',
      'itsaplan'
    ])
    expect(store.getSettings().defaultTaskSource).toBe('itsaplan')
  })

  it('starts a new profile with Itsaplan visible and its one-time migration already stamped', () => {
    const store = createStore()
    expect(store.getSettings().visibleTaskProviders).toContain('itsaplan')
    expect(store.getSettings().visibleTaskProvidersDefaultedForItsaplan).toBe(true)
  })
})
