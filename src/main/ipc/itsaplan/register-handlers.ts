import { ipcMain, shell } from 'electron'
import { itsaplanConnection } from '../../itsaplan/connection'
import { dispatchItsaplanRequest } from '../../itsaplan/request'

export function registerItsaplanHandlers(): void {
  itsaplanConnection.setBrowserOpener((url) => shell.openExternal(url))
  ipcMain.handle('itsaplan:request', (_event, input: unknown) => dispatchItsaplanRequest(input))
}
