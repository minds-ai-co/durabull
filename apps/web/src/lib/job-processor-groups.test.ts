import { describe, expect, test } from 'bun:test'
import { groupJobsByProcessor } from './job-processor-groups'

describe('groupJobsByProcessor', () => {
  test('groups jobs by processor and sorts the processor groups', () => {
    const groups = groupJobsByProcessor([
      { id: '1', name: 'send-email' },
      { id: '2', name: 'archive-order' },
      { id: '3', name: 'send-email' },
    ])

    expect(groups.map((group) => group.name)).toEqual(['archive-order', 'send-email'])
    expect(groups[1]?.jobs.map((job) => job.id)).toEqual(['1', '3'])
  })

  test('keeps unnamed jobs visible in a dedicated fallback group', () => {
    const groups = groupJobsByProcessor([{ id: '1', name: '   ' }])

    expect(groups).toEqual([
      {
        name: 'Unnamed processor',
        jobs: [{ id: '1', name: '   ' }],
      },
    ])
  })
})
