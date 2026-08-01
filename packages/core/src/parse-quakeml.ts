import { XMLParser } from 'fast-xml-parser';
import type { EventDetail, MagnitudeRevision, OriginRevision } from './types';
import { normalizeUtcTime } from './windows';

// fast-xml-parser converte automaticamente i valori numerici (es. depth, latitude);
// gli orari e i publicID restano stringhe. Tipizziamo solo i campi che leggiamo.
interface RawTaggedValue {
  value?: string | number;
}

interface RawOrigin {
  '@_publicID'?: string;
  time?: RawTaggedValue;
  latitude?: RawTaggedValue;
  longitude?: RawTaggedValue;
  depth?: RawTaggedValue;
  evaluationMode?: string;
}

interface RawMagnitude {
  '@_publicID'?: string;
  mag?: RawTaggedValue;
  type?: string;
}

interface RawEvent {
  '@_publicID'?: string;
  description?: { text?: string };
  preferredOriginID?: string;
  preferredMagnitudeID?: string;
  origin?: RawOrigin[];
  magnitude?: RawMagnitude[];
}

interface RawQuakeml {
  quakeml?: {
    eventParameters?: {
      event?: RawEvent[];
    };
  };
}

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  isArray: (name) => name === 'event' || name === 'origin' || name === 'magnitude',
});

/** Estrae l'eventId numerico da un publicID INGV (es. "...?eventId=46608102"). */
function extractEventId(publicId: string): string {
  const m = /eventid=(\d+)/i.exec(publicId);
  return m?.[1] ?? publicId;
}

function parseOrigin(o: RawOrigin): OriginRevision {
  return {
    publicId: String(o['@_publicID'] ?? ''),
    time: normalizeUtcTime(String(o.time?.value ?? '')),
    latitude: Number(o.latitude?.value),
    longitude: Number(o.longitude?.value),
    // QuakeML fornisce la profondità in metri: convertita in km per il resto dell'app.
    depthKm: Number(o.depth?.value) / 1000,
    evaluationMode:
      o.evaluationMode === 'manual' || o.evaluationMode === 'automatic' ? o.evaluationMode : null,
  };
}

function parseMagnitude(m: RawMagnitude): MagnitudeRevision {
  return {
    publicId: String(m['@_publicID'] ?? ''),
    value: Number(m.mag?.value),
    type: String(m.type ?? ''),
  };
}

/** Parsa il QuakeML del dettaglio evento INGV (includeallorigins/includeallmagnitudes). */
export function parseQuakemlEvent(xml: string): EventDetail | null {
  if (xml.trim() === '') return null;

  let doc: RawQuakeml;
  try {
    doc = parser.parse(xml) as RawQuakeml;
  } catch {
    return null;
  }

  const ev = doc.quakeml?.eventParameters?.event?.[0];
  if (!ev) return null;

  const origins = (ev.origin ?? []).map(parseOrigin);
  const magnitudes = (ev.magnitude ?? []).map(parseMagnitude);
  if (origins.length === 0 || magnitudes.length === 0) return null;

  const preferredOrigin =
    origins.find((o) => o.publicId === ev.preferredOriginID) ?? origins[origins.length - 1];
  const preferredMagnitude =
    magnitudes.find((m) => m.publicId === ev.preferredMagnitudeID) ?? magnitudes[magnitudes.length - 1];
  if (!preferredOrigin || !preferredMagnitude) return null;

  return {
    eventId: extractEventId(String(ev['@_publicID'] ?? '')),
    locationName: String(ev.description?.text ?? ''),
    preferredOrigin,
    preferredMagnitude,
    origins,
    magnitudes,
  };
}
