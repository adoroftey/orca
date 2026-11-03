import { ipcMain } from 'electron'
import { dispatchItsaplanRequest } from '../../itsaplan/request'

export function registerItsaplanHandlers(): void {
  ipcMain.handle('itsaplan:request', (_event, input: unknown) => dispatchItsaplanRequest(input))
}
