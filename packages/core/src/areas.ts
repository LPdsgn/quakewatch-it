export interface BoundingBox {
	minLat: number
	maxLat: number
	minLon: number
	maxLon: number
}

export interface AreaPreset {
	id: string
	label: string
	bbox: BoundingBox
}

/** Lista configurabile delle aree preset (spec §2). Bbox Campi Flegrei da docs/api-web-services.md. */
export const AREA_PRESETS: readonly AreaPreset[] = [
	{
		id: 'italia',
		label: 'Tutta Italia',
		bbox: { minLat: 35.0, maxLat: 47.5, minLon: 6.0, maxLon: 19.0 },
	},
	{
		id: 'campi-flegrei',
		label: 'Campi Flegrei',
		bbox: { minLat: 40.75, maxLat: 40.9, minLon: 13.95, maxLon: 14.3 },
	},
	{
		id: 'etna',
		label: 'Etna',
		bbox: { minLat: 37.6, maxLat: 37.9, minLon: 14.85, maxLon: 15.25 },
	},
]

export function findAreaPreset(id: string): AreaPreset | undefined {
	return AREA_PRESETS.find((a) => a.id === id)
}
