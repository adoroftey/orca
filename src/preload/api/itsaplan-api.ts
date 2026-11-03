import type { ItsaplanApi } from '../../shared/itsaplan/types'
import type { ItsaplanCaller } from '../../shared/itsaplan/transport'

export type ItsaplanHostApi = ItsaplanApi & { request: ItsaplanCaller }
