import { describe, expect, it } from 'vitest';
import { hasRevisions, revisionStatus } from '../src/revisions';
import type { EventDetail, MagnitudeRevision, OriginRevision } from '../src/types';

const origin = (id: string, mode: OriginRevision['evaluationMode']): OriginRevision => ({
  publicId: id,
  time: '2026-08-01T10:00:00Z',
  latitude: 42,
  longitude: 13,
  depthKm: 10,
  evaluationMode: mode,
});

const mag = (id: string, value: number): MagnitudeRevision => ({
  publicId: id,
  value,
  type: 'ML',
});

const detail = (origins: OriginRevision[], magnitudes: MagnitudeRevision[]): EventDetail => ({
  eventId: 'x',
  locationName: 'Test',
  preferredOrigin: origins[origins.length - 1]!,
  preferredMagnitude: magnitudes[magnitudes.length - 1]!,
  origins,
  magnitudes,
});

describe('revisionStatus', () => {
  it('origin preferita manuale → rivisto', () => {
    expect(revisionStatus(detail([origin('a', 'automatic'), origin('b', 'manual')], [mag('m', 2)])))
      .toBe('rivisto');
  });

  it('origin preferita automatica → preliminare', () => {
    expect(revisionStatus(detail([origin('a', 'automatic')], [mag('m', 2)])))
      .toBe('preliminare');
  });

  it('evaluationMode assente → preliminare (prudenza)', () => {
    expect(revisionStatus(detail([origin('a', null)], [mag('m', 2)])))
      .toBe('preliminare');
  });
});

describe('hasRevisions', () => {
  it('true con più di una origin o magnitudo', () => {
    expect(hasRevisions(detail([origin('a', null), origin('b', null)], [mag('m', 2)])))
      .toBe(true);
    expect(hasRevisions(detail([origin('a', null)], [mag('m', 2), mag('n', 2.2)])))
      .toBe(true);
  });

  it('false con una sola origin e una sola magnitudo', () => {
    expect(hasRevisions(detail([origin('a', null)], [mag('m', 2)])))
      .toBe(false);
  });
});
