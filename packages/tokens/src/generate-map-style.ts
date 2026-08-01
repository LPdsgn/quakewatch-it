import { MAP_DARK, MAP_LIGHT } from './palette.ts'
import type { ThemeName } from './semantic.ts'

interface MapLayer {
	id: string
	type: string
	source?: string
	'source-layer'?: string
	filter?: unknown[]
	paint?: Record<string, unknown>
}

export interface MapStyle {
	version: 8
	sources: Record<string, { type: string; url: string }>
	layers: MapLayer[]
}

export function buildMapStyle(theme: ThemeName): MapStyle {
	const c = theme === 'theme-dark' ? MAP_DARK : MAP_LIGHT
	return {
		version: 8,
		sources: {
			openfreemap: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
		},
		layers: [
			{ id: 'background', type: 'background', paint: { 'background-color': c.land } },
			{
				id: 'water',
				type: 'fill',
				source: 'openfreemap',
				'source-layer': 'water',
				paint: { 'fill-color': c.water },
			},
			{
				id: 'boundary-country',
				type: 'line',
				source: 'openfreemap',
				'source-layer': 'boundary',
				filter: ['all', ['==', ['get', 'admin_level'], 2], ['==', ['get', 'maritime'], 0]],
				paint: { 'line-color': c.boundaryCountry, 'line-width': 1 },
			},
			{
				id: 'boundary-region',
				type: 'line',
				source: 'openfreemap',
				'source-layer': 'boundary',
				filter: ['all', ['==', ['get', 'admin_level'], 4], ['==', ['get', 'maritime'], 0]],
				paint: { 'line-color': c.boundaryRegion, 'line-width': 1 },
			},
		],
	}
}
