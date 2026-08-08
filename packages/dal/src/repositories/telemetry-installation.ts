import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { telemetryInstallation } from '../db/schemas/telemetry-installation/schema'

const DEFAULT_TELEMETRY_INSTALLATION_ID = 'default'

export const telemetryInstallationRepository = {
  async readAnonymousInstanceId(): Promise<string | null> {
    const db = await getDb()
    const existing = await db
      .select({ anonymousInstanceId: telemetryInstallation.anonymousInstanceId })
      .from(telemetryInstallation)
      .where(eq(telemetryInstallation.id, DEFAULT_TELEMETRY_INSTALLATION_ID))
      .limit(1)

    return existing[0]?.anonymousInstanceId ?? null
  },

  async getOrCreateAnonymousInstanceId(): Promise<string> {
    const existingId = await this.readAnonymousInstanceId()
    if (existingId) {
      return existingId
    }

    const db = await getDb()
    const now = new Date()

    const [created] = await db
      .insert(telemetryInstallation)
      .values({
        id: DEFAULT_TELEMETRY_INSTALLATION_ID,
        anonymousInstanceId: randomUUID(),
        lastSeenAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing()
      .returning({ anonymousInstanceId: telemetryInstallation.anonymousInstanceId })

    if (created) return created.anonymousInstanceId

    const raced = await db
      .select({ anonymousInstanceId: telemetryInstallation.anonymousInstanceId })
      .from(telemetryInstallation)
      .where(eq(telemetryInstallation.id, DEFAULT_TELEMETRY_INSTALLATION_ID))
      .limit(1)

    if (!raced[0]) {
      throw new Error('Failed to initialize anonymous telemetry installation identity.')
    }

    return raced[0].anonymousInstanceId
  },
}
