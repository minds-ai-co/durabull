import { describe, expect, test } from 'bun:test'
import { parseProcessorComponents } from './processor-components'

describe('parseProcessorComponents', () => {
  test('returns an empty list when configuration is absent', () => {
    expect(parseProcessorComponents(undefined)).toEqual([])
  })

  test('parses deployment component metadata', () => {
    expect(
      parseProcessorComponents(
        JSON.stringify([
          {
            name: 'processor-build-p1',
            label: 'Creation · phase 1',
            description: 'Grounds audiences and starts Mind creation.',
            processors: ['draft-group', 'group-creation'],
          },
        ])
      )
    ).toEqual([
      {
        name: 'processor-build-p1',
        label: 'Creation · phase 1',
        description: 'Grounds audiences and starts Mind creation.',
        processors: ['draft-group', 'group-creation'],
      },
    ])
  })

  test('rejects a processor assigned to multiple components', () => {
    expect(() =>
      parseProcessorComponents(
        JSON.stringify([
          {
            name: 'first',
            label: 'First',
            description: 'First component.',
            processors: ['shared-job'],
          },
          {
            name: 'second',
            label: 'Second',
            description: 'Second component.',
            processors: ['shared-job'],
          },
        ])
      )
    ).toThrow('assigned to both')
  })
})
