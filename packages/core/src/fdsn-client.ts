import type { AreaPreset } from './areas';
import type { TimeWindow } from './windows';
import { WINDOW_CONFIG, canonicalWindowRange } from './windows';

const EVENT_PATH = '/fdsnws/event/1/query';

/** URL canonica per la lista eventi di una finestra/area (stessa URL nello stesso minuto). */
export function buildEventsUrl(baseUrl: string, window: TimeWindow, area: AreaPreset, now: Date): URL {
  const url = new URL(EVENT_PATH, baseUrl);
  const { starttime, endtime } = canonicalWindowRange(window, now);
  url.searchParams.set('format', 'text');
  url.searchParams.set('orderby', 'time');
  url.searchParams.set('starttime', starttime);
  url.searchParams.set('endtime', endtime);
  url.searchParams.set('minlatitude', String(area.bbox.minLat));
  url.searchParams.set('maxlatitude', String(area.bbox.maxLat));
  url.searchParams.set('minlongitude', String(area.bbox.minLon));
  url.searchParams.set('maxlongitude', String(area.bbox.maxLon));
  const { minMagnitude } = WINDOW_CONFIG[window];
  if (minMagnitude !== null) url.searchParams.set('minmagnitude', String(minMagnitude));
  return url;
}

/** URL del dettaglio evento in QuakeML con l'intero storico revisioni. */
export function buildEventDetailUrl(baseUrl: string, eventId: string): URL {
  const url = new URL(EVENT_PATH, baseUrl);
  url.searchParams.set('eventid', eventId);
  url.searchParams.set('includeallorigins', 'true');
  url.searchParams.set('includeallmagnitudes', 'true');
  return url;
}
