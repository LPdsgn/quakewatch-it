/** Evento sismico normalizzato dal formato FDSN text. Orari sempre ISO 8601 UTC con Z. */
export interface Earthquake {
  eventId: string;
  time: string;
  latitude: number;
  longitude: number;
  /** Profondità in km (il formato text la fornisce già in km). */
  depthKm: number;
  magnitude: number;
  /** ML, Mw, Md, ... */
  magnitudeType: string;
  locationName: string;
}

/** Una localizzazione dell'evento (l'API ne restituisce più d'una se rivisto). */
export interface OriginRevision {
  publicId: string;
  time: string;
  latitude: number;
  longitude: number;
  /** In km (QuakeML fornisce metri: conversione nel parser). */
  depthKm: number;
  evaluationMode: "manual" | "automatic" | null;
}

/** Una stima di magnitudo (più d'una se rivista). */
export interface MagnitudeRevision {
  publicId: string;
  value: number;
  type: string;
}

/** Dettaglio evento con storico revisioni (spec §2, dettaglio evento). */
export interface EventDetail {
  eventId: string;
  locationName: string;
  preferredOrigin: OriginRevision;
  preferredMagnitude: MagnitudeRevision;
  origins: OriginRevision[];
  magnitudes: MagnitudeRevision[];
}
