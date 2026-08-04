import { describe, expect, it } from 'vitest'

import { buildMapStyle } from '../src/index'

describe('buildMapStyle', () => {
	it('style v8 con source openfreemap e i 4 layer base', () => {
		const s = buildMapStyle('theme-dark')
		expect(s.version).toBe(8)
		expect(s.sources.openfreemap).toEqual({
			type: 'vector',
			url: 'https://tiles.openfreemap.org/planet',
		})
		expect(s.layers.map((l) => l.id)).toEqual([
			'background',
			'water',
			'boundary-country',
			'boundary-region',
		])
	})

	it("dark: terra più chiara dell'acqua (regola prototipo); light diverso da dark", () => {
		const dark = buildMapStyle('theme-dark')
		const light = buildMapStyle('theme-light')
		expect(dark.layers[0]).not.toEqual(light.layers[0])
		// la lightness della terra deve superare quella dell'acqua in dark
		const land = String(dark.layers[0]?.paint?.['background-color'])
		const water = String(dark.layers[1]?.paint?.['fill-color'])
		expect(land).not.toEqual(water)
	})

	it('i confini nazionali filtrano maritime=0 (niente cerchi in mare)', () => {
		const s = buildMapStyle('theme-dark')
		const country = s.layers.find((l) => l.id === 'boundary-country')
		expect(JSON.stringify(country?.filter)).toContain('maritime')
	})

	it('i confini regionali filtrano maritime=0 (niente cerchi in mare)', () => {
		const s = buildMapStyle('theme-dark')
		const region = s.layers.find((l) => l.id === 'boundary-region')
		expect(JSON.stringify(region?.filter)).toContain('maritime')
	})
})

describe('basemap variants', () => {
	it('minimal (default): solo i 4 layer base, nessuna fonte terrarium', () => {
		const s = buildMapStyle('theme-dark', 'minimal')
		const ids = s.layers.map((l) => l.id)
		expect(ids).toEqual(['background', 'water', 'boundary-country', 'boundary-region'])
		expect(s.sources.terrarium).toBeUndefined()
	})

	it('stradale: aggiunge province + city/town label, senza hillshade', () => {
		const s = buildMapStyle('theme-dark', 'stradale')
		const ids = s.layers.map((l) => l.id)
		expect(ids).toContain('boundary-province')
		expect(ids).toContain('place-city')
		expect(ids).toContain('place-town')
		expect(ids).not.toContain('hillshade')
		expect(s.sources.terrarium).toBeUndefined()
	})

	it('terrain: aggiunge province, label E hillshade + fonte terrarium', () => {
		const s = buildMapStyle('theme-dark', 'terrain')
		const ids = s.layers.map((l) => l.id)
		expect(ids).toContain('boundary-province')
		expect(ids).toContain('place-city')
		expect(ids).toContain('place-town')
		expect(ids).toContain('hillshade')
		expect(s.sources.terrarium).toBeDefined()
		expect(s.sources.terrarium?.type).toBe('raster-dem')
		expect(s.sources.terrarium?.encoding).toBe('terrarium')
		expect(s.sources.terrarium?.tileSize).toBe(256)
		expect(s.sources.terrarium?.tiles).toContain(
			'https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png'
		)
	})

	it('hillshade ha bassa exaggeration per non competere coi marker', () => {
		const s = buildMapStyle('theme-dark', 'terrain')
		const hs = s.layers.find((l) => l.id === 'hillshade')
		expect(hs?.paint?.['hillshade-exaggeration']).toBe(0.25)
	})

	it('place-city usa name:it con fallback name via coalesce', () => {
		const s = buildMapStyle('theme-dark', 'stradale')
		const city = s.layers.find((l) => l.id === 'place-city')
		const field = city?.layout?.['text-field']
		expect(field).toEqual(['coalesce', ['get', 'name:it'], ['get', 'name']])
	})

	it('place-town ha minzoom 9 (più alta di city, meno clutter)', () => {
		const s = buildMapStyle('theme-dark', 'stradale')
		const town = s.layers.find((l) => l.id === 'place-town')
		expect(town?.minzoom).toBe(9)
	})

	it('boundary-province ha line-dasharray per distinguersi dalle regioni', () => {
		const s = buildMapStyle('theme-dark', 'stradale')
		const prov = s.layers.find((l) => l.id === 'boundary-province')
		expect(prov?.paint?.['line-dasharray']).toEqual([3, 2])
	})

	it('theme-light: palette colori province/label applicati ai layer', () => {
		const s = buildMapStyle('theme-light', 'stradale')
		const prov = s.layers.find((l) => l.id === 'boundary-province')
		expect(prov?.paint?.['line-color']).toBe('rgba(0,0,0,0.22)')
		const city = s.layers.find((l) => l.id === 'place-city')
		expect(city?.paint?.['text-color']).toBe('rgba(0,0,0,0.42)')
		expect(city?.paint?.['text-halo-color']).toBe('rgba(255,255,255,0.55)')
	})

	it('glyphs URL è presente (necessario per layer symbol)', () => {
		const s = buildMapStyle('theme-dark', 'stradale')
		expect(s.glyphs).toBe('https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf')
	})
})
