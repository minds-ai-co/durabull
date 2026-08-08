import { env } from '@durabull/env'
import { z } from 'zod'

const componentNameSchema = z.string().trim().min(1).max(80)
const processorNameSchema = z.string().trim().min(1).max(120)

const processorComponentSchema = z
  .object({
    name: componentNameSchema,
    label: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(240),
    processors: z.array(processorNameSchema).min(1).max(100),
  })
  .strict()

const processorComponentsSchema = z.array(processorComponentSchema).max(50)

export type ProcessorComponent = z.infer<typeof processorComponentSchema>

export function parseProcessorComponents(raw: string | undefined): ProcessorComponent[] {
  if (!raw?.trim()) return []

  let decoded: unknown
  try {
    decoded = JSON.parse(raw)
  } catch {
    throw new Error('DURABULL_PROCESSOR_COMPONENTS must be valid JSON')
  }

  const components = processorComponentsSchema.parse(decoded)
  const componentNames = new Set<string>()
  const processorOwners = new Map<string, string>()

  for (const component of components) {
    if (componentNames.has(component.name)) {
      throw new Error(`Duplicate processor component name: ${component.name}`)
    }
    componentNames.add(component.name)

    const localProcessors = new Set<string>()
    for (const processor of component.processors) {
      if (localProcessors.has(processor)) {
        throw new Error(`Duplicate processor "${processor}" in component "${component.name}"`)
      }
      localProcessors.add(processor)

      const existingOwner = processorOwners.get(processor)
      if (existingOwner) {
        throw new Error(
          `Processor "${processor}" is assigned to both "${existingOwner}" and "${component.name}"`
        )
      }
      processorOwners.set(processor, component.name)
    }
  }

  return components
}

export function getProcessorComponents(): ProcessorComponent[] {
  return parseProcessorComponents(env.DURABULL_PROCESSOR_COMPONENTS)
}
