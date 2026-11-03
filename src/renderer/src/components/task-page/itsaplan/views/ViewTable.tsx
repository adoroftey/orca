import { translate } from '@/i18n/i18n'
import { EMPTY_ISSUES } from './view-guards'
import { planningFieldLabel } from './ViewLabels'
import { IssueRelations } from './ViewPresentation'
import { ViewGroups, displayProperties, property, type LayoutProps } from './ViewIssueLayout'
export function ViewTable(props: LayoutProps) {
  const properties = displayProperties(props.display)
  return (
    <ViewGroups
      {...props}
      render={(issues) => (
        <div className="min-w-0 overflow-x-auto">
          <table
            className="w-full text-left text-sm"
            style={{ minWidth: `${240 + properties.length * 120}px` }}
          >
            <thead>
              <tr>
                <th className="px-3 py-2 align-top">
                  {translate('itsaplan.planning.views.issue', 'Issue')}
                </th>
                {properties.map((p) => (
                  <th key={p} className="whitespace-nowrap px-3 py-2 align-top">
                    {planningFieldLabel(p, props.metadata)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {issues.map((issue) => (
                <tr key={issue.id} className="border-t">
                  <td className="min-w-60 max-w-96 px-3 py-2 align-top">
                    <button
                      className="text-left hover:underline"
                      onClick={() => props.onOpenIssue(issue.id)}
                    >
                      {issue.identifier} {issue.title}
                    </button>
                    <IssueRelations
                      issue={issue}
                      allIssues={props.allIssues ?? EMPTY_ISSUES}
                      display={props.display}
                      onOpenIssue={props.onOpenIssue}
                    />
                  </td>
                  {properties.map((p) => (
                    <td key={p} className="whitespace-nowrap px-3 py-2 align-top">
                      {property(issue, p, props.metadata)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    />
  )
}
