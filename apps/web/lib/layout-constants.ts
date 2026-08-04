/** Snap point del Drawer mobile (mobile-sheet.tsx): frazioni di viewport height.
 *  Condivisi con home-client.tsx (stato snap) e map-legend.tsx (offset legenda). */
export const SHEET_PEEK = 0.18
export const SHEET_HALF = 0.5
export const SHEET_FULL = 0.85

/** Altezza approssimativa degli elementi fissi in alto su mobile (header + chips),
 *  usata come padding.top nel flyTo quando si seleziona un evento con drawer aperto.
 *  ponytail: stima conservativa (~header py-2.5 + Summary + gap), si calibra a vista. */
export const MOBILE_TOP_BAR_HEIGHT = 180
