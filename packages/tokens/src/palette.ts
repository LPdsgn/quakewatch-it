/** Scale neutre: dark-900 (fondo) → dark-500 (bordi); light speculare. */
export const NEUTRAL_DARK = {
	900: 'hsl(0 0% 4%)', // sfondo app (quasi-OLED)
	850: 'hsl(0 0% 5.5%)', // ground sidebar
	800: 'hsl(0 0% 7.5%)', // card/pane
	700: 'hsl(0 0% 11%)', // popover
	600: 'hsl(0 0% 16%)', // muted
	500: 'hsl(0 0% 22%)', // border/input
} as const

export const NEUTRAL_LIGHT = {
	900: 'hsl(0 0% 96%)',
	850: 'hsl(0 0% 93%)',
	800: 'hsl(0 0% 89%)',
	700: 'hsl(0 0% 84%)',
	600: 'hsl(0 0% 77%)',
	500: 'hsl(0 0% 68%)',
} as const

/** Primary: il rosso Nothing (~355). Identico nei due temi (spec §3). */
export const RED = {
	500: 'hsl(355 85% 55%)',
	400: 'hsl(355 90% 63%)',
	600: 'hsl(355 80% 46%)',
} as const

/** Status: error è un rosso SMORZATO e distinto dal primary (vincolo spec). */
export const STATUS = {
	error: 'hsl(0 55% 42%)',
	warning: 'hsl(45 90% 50%)',
	success: 'hsl(150 40% 42%)',
	info: 'hsl(205 60% 55%)',
} as const

export const TEXT_DARK = { primary: 'hsl(0 0% 93%)', secondary: 'hsl(0 0% 54%)' } as const
export const TEXT_LIGHT = { primary: 'hsl(0 0% 7%)', secondary: 'hsl(0 0% 38%)' } as const

/** Map tile styles per tema. Dark: terra > acqua (contrasto); light: schema classico carta. */
export const MAP_DARK = {
	land: 'hsl(0 0% 8.5%)',
	water: 'hsl(0 0% 4%)',
	boundaryCountry: 'rgba(255,255,255,0.28)',
	boundaryRegion: 'rgba(255,255,255,0.10)',
	/** Province (admin_level 6) — tra regioni e stati per gerarchia visiva. */
	boundaryProvince: 'rgba(255,255,255,0.18)',
	/** Label città: `name:it` con fallback `name`. Halo scuro per leggibilità su land. */
	placeLabel: 'rgba(255,255,255,0.42)',
	placeHalo: 'rgba(0,0,0,0.55)',
} as const

export const MAP_LIGHT = {
	land: 'hsl(0 0% 94%)',
	water: 'hsl(0 0% 85%)',
	boundaryCountry: 'rgba(0,0,0,0.35)',
	boundaryRegion: 'rgba(0,0,0,0.12)',
	boundaryProvince: 'rgba(0,0,0,0.22)',
	placeLabel: 'rgba(0,0,0,0.42)',
	placeHalo: 'rgba(255,255,255,0.55)',
} as const
