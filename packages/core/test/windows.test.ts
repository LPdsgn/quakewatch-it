import { describe, expect, it } from 'vitest';
import {
  TIME_WINDOWS, WINDOW_CONFIG, canonicalWindowRange, normalizeUtcTime, toFdsnTime,
} from '../src/windows';

describe('toFdsnTime', () => {
  it('formatta ISO UTC senza millisecondi né Z (formato FDSN)', () => {
    expect(toFdsnTime(new Date('2026-08-01T10:23:45.678Z'))).toBe('2026-08-01T10:23:45');
  });
});

describe('normalizeUtcTime', () => {
  it('aggiunge Z a orari INGV senza suffisso', () => {
    expect(normalizeUtcTime('2026-08-01T10:23:45')).toBe('2026-08-01T10:23:45Z');
  });
  it('tronca i microsecondi a millisecondi', () => {
    expect(normalizeUtcTime('2026-08-01T10:23:45.123456')).toBe('2026-08-01T10:23:45.123Z');
  });
  it('non duplica la Z se già presente', () => {
    expect(normalizeUtcTime('2026-08-01T10:23:45Z')).toBe('2026-08-01T10:23:45Z');
  });
});

describe('canonicalWindowRange', () => {
  const now = new Date('2026-08-01T10:23:45.678Z');

  it('quantizza endtime al minuto (query canoniche → cache CDN condivisa)', () => {
    const { endtime } = canonicalWindowRange('24h', now);
    expect(endtime).toBe('2026-08-01T10:23:00');
  });

  it('starttime = endtime - durata finestra', () => {
    const { starttime } = canonicalWindowRange('24h', now);
    expect(starttime).toBe('2026-07-31T10:23:00');
  });

  it('due chiamate nello stesso minuto producono lo stesso range', () => {
    const a = canonicalWindowRange('7d', new Date('2026-08-01T10:23:01Z'));
    const b = canonicalWindowRange('7d', new Date('2026-08-01T10:23:59Z'));
    expect(a).toEqual(b);
  });

  it('config: 24h/7d senza soglia, 30d/90d con minMagnitude 2', () => {
    expect(TIME_WINDOWS).toEqual(['24h', '7d', '30d', '90d']);
    expect(WINDOW_CONFIG['24h'].minMagnitude).toBeNull();
    expect(WINDOW_CONFIG['7d'].minMagnitude).toBeNull();
    expect(WINDOW_CONFIG['30d'].minMagnitude).toBe(2);
    expect(WINDOW_CONFIG['90d'].minMagnitude).toBe(2);
  });
});
