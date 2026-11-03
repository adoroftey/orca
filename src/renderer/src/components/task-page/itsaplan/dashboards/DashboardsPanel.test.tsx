// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ItsaplanDashboardsPanel } from './DashboardsPanel'
import type { ItsaplanProjectDetails } from '../../../../../../shared/itsaplan/types'
import { makeApi, makePlanning } from './DashboardsPanel.fixture'
vi.mock('./DashboardWidget', () => ({ ItsaplanDashboardWidget: () => <div>Widget content</div> }))
afterEach(cleanup)
function setup(edit = true, manage = false) {
  const project = { id: 1, key: 'P', ref: 'p', name: 'P', dashboardsEnabled: true }
  const metadata = {
    project,
    columns: [],
    assignees: [],
    permissions: { dashboards: { read: true, edit, create: manage, delete: manage } }
  } satisfies ItsaplanProjectDetails
  const layout = [
    { id: 'a', type: 'stat', x: 1, y: 2, w: 6, h: 2, config: { future: 7 }, future: 8 },
    'future entry'
  ]
  const dashboard = {
    id: 1,
    projectId: 1,
    name: 'Saved',
    icon: null,
    layout,
    position: 0,
    createdAt: ''
  }
  const planning = makePlanning({
    listDashboards: vi.fn().mockResolvedValue([dashboard]),
    updateDashboard: vi.fn().mockResolvedValue(dashboard),
    createDashboard: vi.fn().mockResolvedValue(dashboard),
    deleteDashboard: vi.fn().mockResolvedValue(undefined)
  })
  const api = makeApi({ listIssues: vi.fn().mockResolvedValue([]) })
  render(
    <ItsaplanDashboardsPanel
      api={api}
      planning={planning}
      project={project}
      metadata={metadata}
      onOpenIssue={vi.fn()}
    />
  )
  return { planning, layout }
}
it('saves draft geometry while preserving unknown entries and fields', async () => {
  const { planning, layout } = setup()
  fireEvent.click(await screen.findByRole('button', { name: 'Saved' }))
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
  fireEvent.change(screen.getByLabelText('X position'), { target: { value: '3' } })
  expect(layout[0]).toMatchObject({ x: 1 })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() =>
    expect(planning.updateDashboard).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        layout: [
          expect.objectContaining({ id: 'a', x: 3, future: 8, config: { future: 7 } }),
          'future entry'
        ]
      })
    )
  )
})
it('keeps the draft when saving fails and discards it on request', async () => {
  const { planning } = setup()
  vi.mocked(planning.updateDashboard).mockRejectedValue(new Error('no'))
  fireEvent.click(await screen.findByRole('button', { name: 'Saved' }))
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Draft' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByRole('alert')).toBeInTheDocument()
  expect(screen.getByLabelText('Name')).toHaveValue('Draft')
  fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
  expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
})
it('does not offer editing without permission', async () => {
  setup(false)
  fireEvent.click(await screen.findByRole('button', { name: 'Saved' }))
  expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
})

it('saves forecast selection and clamps numeric settings without losing future config', async () => {
  const { planning } = setup()
  fireEvent.click(await screen.findByRole('button', { name: 'Saved' }))
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
  fireEvent.change(screen.getByLabelText('Widget type'), { target: { value: 'burnup' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add widget' }))
  fireEvent.change(screen.getByLabelText('Forecast style'), { target: { value: 'range' } })
  fireEvent.change(screen.getByLabelText('Forecast weeks'), { target: { value: '999' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() =>
    expect(planning.updateDashboard).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        layout: expect.arrayContaining([
          expect.objectContaining({
            type: 'burnup',
            config: expect.objectContaining({ forecast: 'range', forecastWeeks: 52 })
          })
        ])
      })
    )
  )
})

it('derives a stacked layout on a narrow container without overwriting desktop geometry', async () => {
  let resize: (() => void) | undefined
  vi.stubGlobal(
    'ResizeObserver',
    class implements ResizeObserver {
      constructor(private callback: ResizeObserverCallback) {}
      observe(target: Element) {
        resize = () =>
          this.callback(
            [
              {
                target,
                contentRect: new DOMRectReadOnly(0, 0, 400, 0),
                borderBoxSize: [],
                contentBoxSize: [],
                devicePixelContentBoxSize: []
              }
            ],
            this
          )
      }
      disconnect() {}
      unobserve() {}
    }
  )
  const { planning, layout } = setup()
  fireEvent.click(await screen.findByRole('button', { name: 'Saved' }))
  const card = screen.getByText('Statistics').parentElement!
  expect(card.style.gridColumn).toBe('2 / span 6')
  resize?.()
  await waitFor(() => expect(card.style.gridColumn).toBe(''))
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(planning.updateDashboard).not.toHaveBeenCalled()
  expect(layout[0]).toMatchObject({ x: 1, y: 2 })
  vi.unstubAllGlobals()
})

it('resizes only the draft and persists geometry on Save', async () => {
  const { planning } = setup()
  fireEvent.click(await screen.findByRole('button', { name: 'Saved' }))
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
  const handle = screen.getByRole('button', { name: 'Drag to resize' })
  handle.setPointerCapture = vi.fn()
  fireEvent.pointerDown(handle, { pointerId: 1, clientX: 0, clientY: 0 })
  fireEvent.pointerUp(handle, { pointerId: 1, clientX: 100, clientY: 52 })
  expect(planning.updateDashboard).not.toHaveBeenCalled()
  expect(screen.getByLabelText('Width')).toHaveValue(8)
  expect(screen.getByLabelText('Height')).toHaveValue(3)
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() =>
    expect(planning.updateDashboard).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        layout: expect.arrayContaining([expect.objectContaining({ id: 'a', w: 8, h: 3 })])
      })
    )
  )
})

it('saves a rename without sending the layout', async () => {
  const { planning } = setup()
  fireEvent.click(await screen.findByRole('button', { name: 'Saved' }))
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Renamed' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(planning.updateDashboard).toHaveBeenCalledWith(1, { name: 'Renamed' }))
})

it('retains a draft when the same field changed on the server', async () => {
  const { planning } = setup()
  fireEvent.click(await screen.findByRole('button', { name: 'Saved' }))
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Draft' } })
  const latest = await planning.listDashboards('p')
  vi.mocked(planning.listDashboards).mockResolvedValue([{ ...latest[0], name: 'Remote' }])
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Conflict')
  expect(screen.getByLabelText('Name')).toHaveValue('Draft')
  expect(planning.updateDashboard).not.toHaveBeenCalled()
})

it('creates, copies, and confirms or cancels deletion according to permissions', async () => {
  const { planning } = setup(true, true)
  fireEvent.click(await screen.findByRole('button', { name: 'New dashboard' }))
  await waitFor(() =>
    expect(planning.createDashboard).toHaveBeenCalledWith('p', {
      name: 'New dashboard',
      icon: null,
      layout: []
    })
  )
  fireEvent.click(await screen.findByRole('button', { name: 'Saved' }))
  fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
  await waitFor(() =>
    expect(planning.createDashboard).toHaveBeenCalledWith(
      'p',
      expect.objectContaining({ name: 'Saved copy' })
    )
  )
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
  expect(planning.deleteDashboard).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
  const dialog = await screen.findByRole('alertdialog')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
  await waitFor(() => expect(planning.deleteDashboard).toHaveBeenCalledWith(1))
})
