import type { Client } from '@modelcontextprotocol/sdk/client/index.js'

export const allowed = `
GET /me get_current_user
GET /projects list_projects
GET /projects/{projectKey} get_project
POST /projects/{projectKey}/issues create_issue
GET /projects/{projectKey}/issues list_issues
GET /projects/{projectKey}/issues/search search_issues
GET /issues/{issueId} get_issue
PATCH /issues/{issueId} update_issue
GET /issues/{issueId}/feed list_issue_activity
POST /issues/{issueId}/comments add_comment
GET /projects/{projectKey}/initiatives list_initiatives
POST /projects/{projectKey}/initiatives create_initiative
GET /initiatives/{initiativeId} get_initiative
PATCH /initiatives/{initiativeId} update_initiative
DELETE /initiatives/{initiativeId} delete_initiative
GET /initiatives/{initiativeId}/feed list_initiative_activity
GET /projects/{projectKey}/views list_views
POST /projects/{projectKey}/views create_view
PUT /projects/{projectKey}/views/reorder reorder_views
PATCH /views/{viewId} update_view
DELETE /views/{viewId} delete_view
GET /projects/{projectKey}/dashboards list_dashboards
POST /projects/{projectKey}/dashboards create_dashboard
PUT /projects/{projectKey}/dashboards/reorder reorder_dashboards
PATCH /dashboards/{dashboardId} update_dashboard
DELETE /dashboards/{dashboardId} delete_dashboard
GET /projects/{projectKey}/analytics/stats get_project_stats
GET /projects/{projectKey}/analytics/breakdown get_project_breakdown
GET /projects/{projectKey}/analytics/pulse get_project_pulse
GET /projects/{projectKey}/analytics/throughput get_project_throughput
GET /projects/{projectKey}/analytics/burnup get_project_burnup
GET /projects/{projectKey}/analytics/activity get_project_activity
GET /projects/{projectKey}/analytics/agent-runs list_agent_runs
GET /projects/{projectKey}/analytics/agent-run-stats get_agent_run_stats
GET /projects/{projectKey}/analytics/webhook-stats get_webhook_stats
GET /projects/{projectKey}/analytics/agent-workload get_agent_workload
`
  .trim()
  .split('\n')
  .map((line) => line.split(' '))
// Responses cross the MCP boundary and are checked before use.
// eslint-disable-next-line typescript/no-explicit-any
export type Obj = Record<string, any>
export function object(value: unknown): value is Obj {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export async function loadTools(client: Client) {
  const tools: Awaited<ReturnType<Client['listTools']>>['tools'] = []
  const cursors = new Set<string>()
  let cursor: string | undefined
  do {
    const page = await client.listTools(cursor ? { cursor } : undefined)
    tools.push(...page.tools)
    cursor = page.nextCursor
    if (tools.length > 10000 || (cursor && cursors.has(cursor))) {
      throw new Error('Invalid Itsaplan tool list.')
    }
    if (cursor) {
      cursors.add(cursor)
    }
  } while (cursor)
  if (new Set(tools.map((tool) => tool.name)).size !== tools.length) {
    throw new Error('Invalid Itsaplan tool list.')
  }

  return tools
}
