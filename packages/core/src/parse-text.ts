import type { Earthquake } from './types'
import { normalizeUtcTime } from './windows'

/**
 * Parsa il formato FDSN text (pipe-separated) in Earthquake[].
 * Righe header (#...), vuote o malformate vengono scartate silenziosamente:
 * il feed è esterno, un record rotto non deve far cadere l'intera lista.
 */
export function parseEventsText(text: string): Earthquake[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'))
    .flatMap((line) => {
      const e = parseLine(line)
      return e ? [e] : []
    })
}

function parseLine(line: string): Earthquake | null {
  const f = line.split('|')
  if (f.length < 13) return null
  const eq: Earthquake = {
    eventId: f[0] ?? '',
    time: normalizeUtcTime(f[1] ?? ''),
    latitude: Number(f[2]),
    longitude: Number(f[3]),
    depthKm: Number(f[4]),
    magnitudeType: f[9] ?? '',
    magnitude: Number(f[10]),
    locationName: f[12] ?? '',
  }
  if (
    eq.eventId === '' ||
    Number.isNaN(eq.latitude) ||
    Number.isNaN(eq.longitude) ||
    Number.isNaN(eq.depthKm) ||
    Number.isNaN(eq.magnitude)
  ) {
    return null
  }
  return eq
}
