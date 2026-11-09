import { createElement } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

describe('test runner', () => {
  it('renders a React element into jsdom', () => {
    render(createElement('p', null, 'Runner ready'))
    expect(screen.getByText('Runner ready')).toBeInTheDocument()
  })

  it('reports an absent element as missing', () => {
    render(createElement('p', null, 'Something else'))
    expect(screen.queryByText('Runner ready')).not.toBeInTheDocument()
  })
})
