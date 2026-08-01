import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseQuakemlEvent } from '../src/parse-quakeml';

const xml = readFileSync(
  fileURLToPath(new URL('./fixtures/event-detail.quakeml.xml', import.meta.url)),
  'utf8',
);

describe('parseQuakemlEvent', () => {
  it('estrae il dettaglio con tutte le revisioni dalla fixture reale', () => {
    const d = parseQuakemlEvent(xml);
    expect(d).not.toBeNull();
    if (!d) return;
    expect(d.eventId).toMatch(/^\d+$/);
    expect(d.origins.length).toBeGreaterThanOrEqual(2); // fixture scelta con revisioni
    expect(d.magnitudes.length).toBeGreaterThanOrEqual(1);
    expect(d.origins.map((o) => o.publicId)).toContain(d.preferredOrigin.publicId);
    expect(d.magnitudes.map((m) => m.publicId)).toContain(d.preferredMagnitude.publicId);
    // profondità QuakeML in metri → convertita in km: per l'Italia sempre < 700 km
    expect(d.preferredOrigin.depthKm).toBeGreaterThan(0);
    expect(d.preferredOrigin.depthKm).toBeLessThan(700);
    expect(d.preferredOrigin.time).toMatch(/Z$/);
    expect(d.locationName.length).toBeGreaterThan(0);
  });

  it('XML non QuakeML → null', () => {
    expect(parseQuakemlEvent('<html></html>')).toBeNull();
  });

  it('stringa vuota → null', () => {
    expect(parseQuakemlEvent('')).toBeNull();
  });
});
