import { describe, expect, it } from 'vitest';
import { AREA_PRESETS, findAreaPreset } from '../src/areas';

describe('AREA_PRESETS', () => {
  it('include almeno Tutta Italia e Campi Flegrei', () => {
    expect(findAreaPreset('italia')?.label).toBe('Tutta Italia');
    expect(findAreaPreset('campi-flegrei')?.label).toBe('Campi Flegrei');
  });

  it('ogni bbox è coerente (min < max)', () => {
    for (const a of AREA_PRESETS) {
      expect(a.bbox.minLat).toBeLessThan(a.bbox.maxLat);
      expect(a.bbox.minLon).toBeLessThan(a.bbox.maxLon);
    }
  });

  it('id sconosciuto → undefined', () => {
    expect(findAreaPreset('atlantide')).toBeUndefined();
  });
});
