import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { parseEventsText } from '../src/parse-text'

const fixture = (name: string) =>
  readFileSync(
    fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)),
    'utf8'
  )

describe('parseEventsText', () => {
  it('parsa la fixture reale in Earthquake[] validi', () => {
    const events = parseEventsText(fixture('events-sample.txt'))
    expect(events.length).toBeGreaterThanOrEqual(3)
    for (const e of events) {
      expect(e.eventId).toMatch(/\S/)
      expect(e.time).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/
      )
      expect(e.latitude).toBeGreaterThan(30)
      expect(e.longitude).toBeGreaterThan(0)
      expect(Number.isFinite(e.depthKm)).toBe(true)
      expect(e.magnitude).toBeGreaterThanOrEqual(2)
      expect(e.magnitudeType.length).toBeGreaterThan(0)
      expect(e.locationName.length).toBeGreaterThan(0)
    }
  })

  it('fixture solo header → lista vuota', () => {
    expect(parseEventsText(fixture('events-empty.txt'))).toEqual([])
  })

  it('stringa vuota → lista vuota', () => {
    expect(parseEventsText('')).toEqual([])
  })

  it('riga malformata (campi mancanti) viene scartata senza lanciare', () => {
    const events = parseEventsText('12345|2026-08-01T10:00:00|42.1\n')
    expect(events).toEqual([])
  })

  it('parsa una riga sintetica nota campo per campo', () => {
    const line =
      '44125672|2026-07-20T05:31:12.940000|40.8218|14.1392|2.5|SURVEY-INGV-OV||||Md|2.2|--|Campi Flegrei\n'
    const [e] = parseEventsText(line)
    expect(e).toEqual({
      eventId: '44125672',
      time: '2026-07-20T05:31:12.940Z',
      latitude: 40.8218,
      longitude: 14.1392,
      depthKm: 2.5,
      magnitude: 2.2,
      magnitudeType: 'Md',
      locationName: 'Campi Flegrei',
    })
  })
})
