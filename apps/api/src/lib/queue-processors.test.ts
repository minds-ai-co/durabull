import { describe, expect, test } from 'bun:test'
import { summarizeObservedProcessors } from './queue-processors'

describe('summarizeObservedProcessors', () => {
  test('returns stable processor components and observed job counts', () => {
    expect(
      summarizeObservedProcessors(
        [{ name: 'send-email' }, { name: 'resize-image' }, { name: 'send-email' }],
        3
      )
    ).toEqual({
      processors: [
        { name: 'resize-image', observedJobs: 1 },
        { name: 'send-email', observedJobs: 2 },
      ],
      sampledJobs: 3,
      totalJobs: 3,
      truncated: false,
      available: true,
    })
  })

  test('normalizes unnamed processors and reports incomplete samples', () => {
    expect(summarizeObservedProcessors([{ name: '   ' }], 10)).toEqual({
      processors: [{ name: 'Unnamed processor', observedJobs: 1 }],
      sampledJobs: 1,
      totalJobs: 10,
      truncated: true,
      available: true,
    })
  })
})
