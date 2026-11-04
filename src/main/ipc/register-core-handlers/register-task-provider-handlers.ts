import { registerLinearHandlers } from '../linear/register-handlers'
import { registerJiraHandlers } from '../jira/register-handlers'
import { registerItsaplanHandlers } from '../itsaplan/register-handlers'

export function registerTaskProviderHandlers(): void {
  registerLinearHandlers()
  registerJiraHandlers()
  registerItsaplanHandlers()
}
