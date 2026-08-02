import type { ThemeName } from './semantic.ts'

/** Classi di magnitudo, convenzione INGV (spec §2, round dataviz). */
export interface MagnitudeClass {
	id: string
	label: string
	min: number
	max: number | null
}

export const MAGNITUDE_CLASSES: readonly MagnitudeClass[] = [
	{ id: 'm0', label: 'Fino a 2', min: 0, max: 2 },
	{ id: 'm2', label: '2.0–2.9', min: 2, max: 3 },
	{ id: 'm3', label: '3.0–3.9', min: 3, max: 4 },
	{ id: 'm4', label: '4.0+', min: 4, max: null },
] as const

/** Classe di appartenenza per magnitudo (min incluso, max escluso; m4 senza tetto). */
export function magnitudeClassOf(magnitude: number): MagnitudeClass {
	const found = MAGNITUDE_CLASSES.find((c) => c.max === null || magnitude < c.max)
	// MAGNITUDE_CLASSES copre (-∞, +∞) grazie al tetto null sull'ultima classe: sempre un match.
	return found ?? (MAGNITUDE_CLASSES[MAGNITUDE_CLASSES.length - 1] as MagnitudeClass)
}

/**
 * Colori per classe di magnitudo, validati coi criteri dataviz (adjacent-pair
 * ΔE(OKLab×100) CVD ≥8, normal-vision floor ≥15, contrasto vs surface).
 * Hue giallo→rosso, passi zigzag in lightness (non monotona) per massimizzare
 * la separazione fra classi adiacenti entro la banda OKLCH del tema:
 * dark L∈[0.48,0.67], light L∈[0.43,0.77] (vedi dataviz skill).
 *
 * Ricetta OKLCH (poi convertita a hex — MapLibre 5 accetta oklch() ma si fissa
 * hex per evitare drift di conversione tra ambienti):
 *   dark:  m0 oklch(0.66 0.17 95) · m2 oklch(0.48 0.21 72)
 *          m3 oklch(0.65 0.20 35) · m4 oklch(0.48 0.26  5)
 *   light: m0 oklch(0.72 0.16 95) · m2 oklch(0.50 0.19 70)
 *          m3 oklch(0.66 0.19 35) · m4 oklch(0.45 0.22 10)
 * Validato con dataviz/scripts/validate_palette.js --mode dark --surface #0a0a0a
 * e --mode light --surface #f5f5f5 (surface reali del tema, non i default dello
 * script): tutti i check PASS, un WARN "contrasto vs surface" per classe (m2 dark,
 * m0 light) — legale solo perché la legenda mostra sempre l'etichetta testuale
 * della classe (vincolo spec, mai colore da solo).
 */
export const MAGNITUDE_COLORS: Record<ThemeName, Record<string, string>> = {
	'theme-dark': { m0: '#b38e00', m2: '#a03900', m3: '#f0532b', m4: '#c2004a' },
	'theme-light': { m0: '#c4a200', m2: '#a34400', m3: '#ef5b36', m4: '#ad0038' },
}

/** Scala MMI (ShakeMap): standard di dominio da shakemap4-web `js/colors.js` (intColors), fisso in entrambi i temi — non si ristilizza. */
export const MMI_SCALE: readonly { value: number; label: string; color: string }[] = [
	{ value: 1, label: 'Non percepito', color: '#FFFFFF' },
	{ value: 2, label: 'Debole', color: '#ACD8E9' },
	{ value: 3, label: 'Debole', color: '#ACD8E9' },
	{ value: 4, label: 'Leggero', color: '#83D0DA' },
	{ value: 5, label: 'Moderato', color: '#7BC87F' },
	{ value: 6, label: 'Forte', color: '#F9F518' },
	{ value: 7, label: 'Molto forte', color: '#FAC611' },
	{ value: 8, label: 'Severo', color: '#FA8A11' },
	{ value: 9, label: 'Violento', color: '#F7100C' },
	{ value: 10, label: 'Estremo', color: '#C80F0A' },
] as const
