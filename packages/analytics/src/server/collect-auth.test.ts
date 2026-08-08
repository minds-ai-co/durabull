import { beforeEach, describe, expect, it } from 'bun:test'

import {
  resetTelemetryCollectReplayCacheForTests,
  signTelemetryCollectBody,
  TELEMETRY_COLLECT_SIGNATURE_TOLERANCE_SEC,
  verifyTelemetryCollectSignature,
} from './collect-auth'

const SECRET = 'test-collect-signing-secret'
const RAW_BODY = JSON.stringify({
  instanceId: '41111111-1111-4111-8111-111111111111',
  events: [{ event: 'queue_paused', properties: {}, sessionId: 'session' }],
})

describe('telemetry collect auth', () => {
  beforeEach(() => {
    resetTelemetryCollectReplayCacheForTests()
  })
  it('signs and verifies collect payloads', () => {
    const timestamp = 1_700_000_000
    const { signature, timestamp: timestampHeader } = signTelemetryCollectBody(
      SECRET,
      timestamp,
      RAW_BODY
    )

    expect(
      verifyTelemetryCollectSignature({
        secret: SECRET,
        timestampHeader,
        signatureHeader: signature,
        rawBody: RAW_BODY,
        nowSec: timestamp,
      })
    ).toEqual({ ok: true })
  })

  it('rejects missing signature headers', () => {
    expect(
      verifyTelemetryCollectSignature({
        secret: SECRET,
        timestampHeader: undefined,
        signatureHeader: undefined,
        rawBody: RAW_BODY,
      })
    ).toEqual({ ok: false, error: 'missing' })
  })

  it('rejects expired signatures', () => {
    const timestamp = 1_700_000_000
    const { signature, timestamp: timestampHeader } = signTelemetryCollectBody(
      SECRET,
      timestamp,
      RAW_BODY
    )

    expect(
      verifyTelemetryCollectSignature({
        secret: SECRET,
        timestampHeader,
        signatureHeader: signature,
        rawBody: RAW_BODY,
        nowSec: timestamp + TELEMETRY_COLLECT_SIGNATURE_TOLERANCE_SEC + 1,
      })
    ).toEqual({ ok: false, error: 'expired' })
  })

  it('rejects tampered bodies', () => {
    const timestamp = 1_700_000_000
    const { signature, timestamp: timestampHeader } = signTelemetryCollectBody(
      SECRET,
      timestamp,
      RAW_BODY
    )

    expect(
      verifyTelemetryCollectSignature({
        secret: SECRET,
        timestampHeader,
        signatureHeader: signature,
        rawBody: `${RAW_BODY} `,
        nowSec: timestamp,
      })
    ).toEqual({ ok: false, error: 'invalid' })
  })

  it('rejects replayed signatures within the tolerance window', () => {
    const timestamp = 1_700_000_000
    const { signature, timestamp: timestampHeader } = signTelemetryCollectBody(
      SECRET,
      timestamp,
      RAW_BODY
    )

    const input = {
      secret: SECRET,
      timestampHeader,
      signatureHeader: signature,
      rawBody: RAW_BODY,
      nowSec: timestamp,
    }

    expect(verifyTelemetryCollectSignature(input)).toEqual({ ok: true })
    expect(verifyTelemetryCollectSignature(input)).toEqual({ ok: false, error: 'replay' })
  })

  it('rejects replayed signatures near the end of the tolerance window', () => {
    const timestamp = 1_700_000_000
    const { signature, timestamp: timestampHeader } = signTelemetryCollectBody(
      SECRET,
      timestamp,
      RAW_BODY
    )

    expect(
      verifyTelemetryCollectSignature({
        secret: SECRET,
        timestampHeader,
        signatureHeader: signature,
        rawBody: RAW_BODY,
        nowSec: timestamp,
      })
    ).toEqual({ ok: true })

    expect(
      verifyTelemetryCollectSignature({
        secret: SECRET,
        timestampHeader,
        signatureHeader: signature,
        rawBody: RAW_BODY,
        nowSec: timestamp + TELEMETRY_COLLECT_SIGNATURE_TOLERANCE_SEC - 1,
      })
    ).toEqual({ ok: false, error: 'replay' })

    expect(
      verifyTelemetryCollectSignature({
        secret: SECRET,
        timestampHeader,
        signatureHeader: signature,
        rawBody: RAW_BODY,
        nowSec: timestamp + TELEMETRY_COLLECT_SIGNATURE_TOLERANCE_SEC,
      })
    ).toEqual({ ok: false, error: 'replay' })
  })

  it('keeps replay protection for future-dated signatures until the validity window ends', () => {
    const nowSec = 1_700_000_000
    const futureTimestamp = nowSec + 200
    const { signature, timestamp: timestampHeader } = signTelemetryCollectBody(
      SECRET,
      futureTimestamp,
      RAW_BODY
    )

    const input = {
      secret: SECRET,
      timestampHeader,
      signatureHeader: signature,
      rawBody: RAW_BODY,
      nowSec,
    }

    expect(verifyTelemetryCollectSignature(input)).toEqual({ ok: true })
    expect(verifyTelemetryCollectSignature({ ...input, nowSec: nowSec + 250 })).toEqual({
      ok: false,
      error: 'replay',
    })
  })
})
