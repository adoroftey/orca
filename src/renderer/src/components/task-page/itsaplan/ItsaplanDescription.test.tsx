// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { ItsaplanDescription } from './ItsaplanDescription'
afterEach(cleanup)
it('keeps folded markdown inert and exposes sanitized content after expansion', () => {
  const { container } = render(
    <ItsaplanDescription
      content={
        '# Heading\n\n- [Link](https://example.com)\n\n```js\nconst x = 1\n```\n\n<script>alert(1)</script>'
      }
    />
  )
  const preview = container.querySelector('[inert]')
  expect(preview).toHaveAttribute('aria-hidden', 'true')
  expect(screen.queryByRole('link', { name: 'Link' })).not.toBeInTheDocument()
  expect(container.querySelector('script')).toBeNull()
  const toggle = screen.getByRole('button', { name: 'Show full description' })
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  fireEvent.click(toggle)
  expect(container.querySelector('[inert]')).toBeNull()
  expect(screen.getByRole('heading', { name: 'Heading' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Link' })).toHaveAttribute('href', 'https://example.com')
  expect(container.querySelector('code')).toHaveTextContent('const x = 1')
  fireEvent.click(screen.getByRole('button', { name: 'Collapse description' }))
  expect(container.querySelector('[inert]')).toHaveAttribute('aria-hidden', 'true')
  expect(screen.queryByRole('link', { name: 'Link' })).not.toBeInTheDocument()
})
it('keeps card previews inert and outside the accessibility tree', () => {
  const { container } = render(
    <ItsaplanDescription content="[Link](https://example.com)" preview />
  )
  expect(container.querySelector('[inert]')).toHaveAttribute('aria-hidden', 'true')
  expect(screen.queryByRole('link', { name: 'Link' })).not.toBeInTheDocument()
})
