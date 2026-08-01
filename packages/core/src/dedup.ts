import type { Earthquake } from "./types";

/**
 * Unione con dedup per eventId (finestra di polling sovrapposta, spec §1).
 * Il record incoming sostituisce l'esistente: le risposte più fresche
 * possono contenere parametri rivisti. Output: time decrescente.
 */
export function mergeEvents(existing: Earthquake[], incoming: Earthquake[]): Earthquake[] {
  const byId = new Map(existing.map((e) => [e.eventId, e]));
  for (const e of incoming) byId.set(e.eventId, e);
  return [...byId.values()].toSorted((a, b) => b.time.localeCompare(a.time));
}
