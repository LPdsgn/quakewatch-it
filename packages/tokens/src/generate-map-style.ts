import { MAP_DARK, MAP_LIGHT } from './palette.ts'
import type { ThemeName } from './semantic.ts'

/** Varianti basemap: minimal (solo confini), stradale (+ province/città), terrain (+ hillshade). */
export type Basemap = 'minimal' | 'stradale' | 'terrain'

interface MapSource {
	type: string
	url?: string
	tiles?: string[]
	encoding?: string
	tileSize?: number
	maxzoom?: number
	attribution?: string
}

interface MapLayer {
	id: string
	type: string
	source?: string
	'source-layer'?: string
	filter?: unknown[]
	layout?: Record<string, unknown>
	paint?: Record<string, unknown>
	minzoom?: number
}

export interface MapStyle {
	version: 8
	glyphs?: string
	sources: Record<string, MapSource>
	layers: MapLayer[]
}

/** AWS terrarium (SRTM) — free, keyless, CORS aperto. Encoding terrarium per raster-dem MapLibre. */
const TERRARIUM_URL = 'https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png'

export function buildMapStyle(theme: ThemeName, basemap: Basemap = 'minimal'): MapStyle {
	const c = theme === 'theme-dark' ? MAP_DARK : MAP_LIGHT

	const showLabels = basemap !== 'minimal'
	const showTerrain = basemap === 'terrain'

	const style: MapStyle = {
		version: 8,
		// Glyphs per layer symbol (place labels). OpenFreeMap serve i font OpenMapTiles standard.
		glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
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
		],
	}

	// Hillshade (terrain): sotto i confini, sopra water. Raster-dem da AWS terrarium.
	if (showTerrain) {
		style.sources.terrarium = {
			type: 'raster-dem',
			tiles: [TERRARIUM_URL],
			encoding: 'terrarium',
			tileSize: 256,
			maxzoom: 15,
			attribution: 'SRTM — AWS Terrarium',
		}
		style.layers.push({
			id: 'hillshade',
			type: 'hillshade',
			source: 'terrarium',
			paint: {
				// ponytail: hillshade sobrio (bassa exaggeration), sfondo non competitivo coi marker.
				'hillshade-exaggeration': 0.25,
				'hillshade-shadow-color': 'hsl(0 0% 0%)',
				'hillshade-highlight-color': 'hsl(0 0% 100%)',
				'hillshade-accent-color': 'hsl(0 0% 0%)',
				'hillshade-illumination-direction': 335,
			},
		})
	}

	// Confini amministrativi
	style.layers.push(
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
		}
	)

	// Province (admin_level 6): dashate per distinguerle da regioni. Solo stradale/terrain.
	if (showLabels) {
		style.layers.push({
			id: 'boundary-province',
			type: 'line',
			source: 'openfreemap',
			'source-layer': 'boundary',
			minzoom: 6,
			filter: ['all', ['==', ['get', 'admin_level'], 6], ['==', ['get', 'maritime'], 0]],
			paint: {
				'line-color': c.boundaryProvince,
				'line-width': 0.75,
				'line-dasharray': [3, 2],
			},
		})
	}

	// Label città (name:it con fallback name). Solo stradale/terrain.
	if (showLabels) {
		style.layers.push(
			{
				id: 'place-city',
				type: 'symbol',
				source: 'openfreemap',
				'source-layer': 'place',
				minzoom: 6,
				filter: ['==', ['get', 'class'], 'city'],
				layout: {
					'text-field': ['coalesce', ['get', 'name:it'], ['get', 'name']],
					'text-font': ['Noto Sans Regular'],
					'text-size': 11,
					'text-max-width': 8,
				},
				paint: {
					'text-color': c.placeLabel,
					'text-halo-color': c.placeHalo,
					'text-halo-width': 1.2,
				},
			},
			{
				id: 'place-town',
				type: 'symbol',
				source: 'openfreemap',
				'source-layer': 'place',
				minzoom: 9,
				filter: ['==', ['get', 'class'], 'town'],
				layout: {
					'text-field': ['coalesce', ['get', 'name:it'], ['get', 'name']],
					'text-font': ['Noto Sans Italic'],
					'text-size': 10,
					'text-max-width': 8,
				},
				paint: {
					'text-color': c.placeLabel,
					'text-halo-color': c.placeHalo,
					'text-halo-width': 1,
				},
			}
		)
	}

	return style
}
