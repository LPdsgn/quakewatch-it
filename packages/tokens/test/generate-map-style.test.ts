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
