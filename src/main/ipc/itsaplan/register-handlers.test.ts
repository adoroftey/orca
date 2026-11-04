import { expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  handle: vi.fn(),
  openExternal: vi.fn(),
  setBrowserOpener: vi.fn()
}))
vi.mock('electron', () => ({
  ipcMain: { handle: mocks.handle },
  shell: { openExternal: mocks.openExternal }
}))
vi.mock('../../itsaplan/connection', () => ({
  itsaplanConnection: { setBrowserOpener: mocks.setBrowserOpener }
}))
vi.mock('../../itsaplan/request', () => ({ dispatchItsaplanRequest: vi.fn() }))
import { registerItsaplanHandlers } from './register-handlers'

it('registers the desktop browser opener on the shared connection', async () => {
  registerItsaplanHandlers()
  expect(mocks.setBrowserOpener).toHaveBeenCalledOnce()
  await mocks.setBrowserOpener.mock.calls[0][0]('https://plan.example/authorize')
  expect(mocks.openExternal).toHaveBeenCalledWith('https://plan.example/authorize')
})
