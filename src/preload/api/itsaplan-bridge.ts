import { ipcRenderer } from 'electron'
import {
  createItsaplanScopedTransportApi,
  type ItsaplanCaller
} from '../../shared/itsaplan/transport'
import type { ItsaplanHostApi } from './itsaplan-api'

const request: ItsaplanCaller = (method, params) =>
  ipcRenderer.invoke('itsaplan:request', { method, ...(params === undefined ? {} : { params }) })

export const itsaplanApi: ItsaplanHostApi = {
  ...createItsaplanScopedTransportApi(request),
  request
}
