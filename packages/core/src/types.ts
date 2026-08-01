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
