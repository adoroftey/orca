import { translate } from '@/i18n/i18n'
export function widgetLabel(type: string): string {
  switch (type) {
    case 'stat':
      return translate('itsaplan.planning.dashboards.widgetStat', 'Statistics')
    case 'recent_issues':
      return translate('itsaplan.planning.dashboards.widgetRecentIssues', 'Recent issues')
    case 'activity_feed':
      return translate('itsaplan.planning.dashboards.widgetActivity', 'Activity feed')
    case 'pulse':
      return translate('itsaplan.planning.dashboards.widgetPulse', 'Pulse')
    case 'throughput':
      return translate('itsaplan.planning.dashboards.widgetThroughput', 'Throughput')
    case 'burnup':
      return translate('itsaplan.planning.dashboards.widgetBurnup', 'Burnup')
    case 'breakdown':
      return translate('itsaplan.planning.dashboards.widgetBreakdown', 'Breakdown')
    case 'agent_runs':
      return translate('itsaplan.planning.dashboards.widgetAgentRuns', 'Agent runs')
    case 'agent_health':
      return translate('itsaplan.planning.dashboards.widgetAgentHealth', 'Agent health')
    case 'webhook_health':
      return translate('itsaplan.planning.dashboards.widgetWebhookHealth', 'Webhook health')
    case 'agent_workload':
      return translate('itsaplan.planning.dashboards.widgetAgentWorkload', 'Agent workload')
    default:
      return `${translate('itsaplan.planning.dashboards.unsupportedWidget', 'Unsupported widget type')}: ${type || '—'}`
  }
}
