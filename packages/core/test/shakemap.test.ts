import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { buildShakemapContoursUrl, isShakemapContours } from '../src/shakemap'

const BASE = 'https://shakemap.ingv.it'

const fixture = JSON.parse(
	readFileSync(new URL('./fixtures/shakemap-cont-mi.json', import.meta.url), 'utf8')
)

describe('buildShakemapContoursUrl', () => {
	it('costruisce la URL dei contorni MMI correnti', () => {
		const url = buildShakemapContoursUrl(BASE, '46725592')
		expect(url.toString()).toBe(`${BASE}/data/46725592/current/products/cont_mi.json`)
	})
})

describe('isShakemapContours', () => {
	it('true sulla fixture reale (9 feature MMI)', () => {
		expect(isShakemapContours(fixture)).toBe(true)
	})

	it('false su oggetto vuoto', () => {
		expect(isShakemapContours({})).toBe(false)
	})

	it('false su array', () => {
		expect(isShakemapContours([])).toBe(false)
	})

	it('false su feature senza value numerico', () => {
		expect(
			isShakemapContours({
				type: 'FeatureCollection',
				features: [{ type: 'Feature', properties: { color: '#fff' } }],
			})
		).toBe(false)
	})
})
