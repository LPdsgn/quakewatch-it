/** Contorni MMI ShakeMap (GeoJSON FeatureCollection di MultiLineString). */
export interface ShakemapContours {
	type: 'FeatureCollection'
	features: {
		type: 'Feature'
		geometry: { type: 'MultiLineString'; coordinates: number[][][] }
		properties: {
			value: number
			color: string
			/** Non verificati da isShakemapContours (validazione minima): mai assumerli presenti. */
			units?: string
			weight?: number
		}
	}[]
}

/** URL del prodotto ShakeMap "contorni MMI" corrente per un evento. */
export function buildShakemapContoursUrl(baseUrl: string, eventId: string): URL {
	return new URL(`/data/${eventId}/current/products/cont_mi.json`, baseUrl)
}

/** Validazione minima della struttura: FeatureCollection con value numerico e color stringa. */
export function isShakemapContours(json: unknown): json is ShakemapContours {
	if (typeof json !== 'object' || json === null) return false
	const obj = json as { type?: unknown; features?: unknown }
	if (obj.type !== 'FeatureCollection' || !Array.isArray(obj.features)) return false
	return obj.features.every((feature) => {
		if (typeof feature !== 'object' || feature === null) return false
		const properties = (feature as { properties?: unknown }).properties
		if (typeof properties !== 'object' || properties === null) return false
		const { value, color } = properties as { value?: unknown; color?: unknown }
		return typeof value === 'number' && typeof color === 'string'
	})
}
