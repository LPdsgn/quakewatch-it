import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
	buildShakemapContoursUrl,
	estimateEpicentralMMI,
	isFelt,
	isShakemapContours,
} from '../src/shakemap'

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

describe('estimateEpicentralMMI', () => {
	it('Mw 6.1 a 259 km → MMI ≈ 4.4 (borderline)', () => {
		const mmi = estimateEpicentralMMI(6.1, 259)
		expect(mmi).toBeCloseTo(4.4, 0)
	})

	it('Md 4.7 a 2.5 km → MMI ≈ 7.9 (molto percepibile)', () => {
		const mmi = estimateEpicentralMMI(4.7, 2.5)
		expect(mmi).toBeCloseTo(7.9, 0)
	})

	it('profondità < 1 km → clamped a R=1 (evita log(0))', () => {
		const mmi = estimateEpicentralMMI(3.0, 0.3)
		expect(mmi).toBeGreaterThan(0)
		expect(Number.isFinite(mmi)).toBe(true)
	})

	it('Mw 2.0 a 10 km → MMI ≈ 3.1', () => {
		const mmi = estimateEpicentralMMI(2.0, 10)
		expect(mmi).toBeCloseTo(3.1, 0)
	})
})

describe('isFelt', () => {
	it('Mw 6.1 a 259 km → percepito', () => {
		expect(isFelt(6.1, 259)).toBe(true)
	})

	it('Mw 2.0 a 10 km → percepito (MMI ≈ 3.1, soglia III)', () => {
		expect(isFelt(2.0, 10)).toBe(true)
	})

	it('Mw 2.0 a 50 km → NON percepito', () => {
		expect(isFelt(2.0, 50)).toBe(false)
	})

	it('Mw 1.0 a 5 km → NON percepito', () => {
		expect(isFelt(1.0, 5)).toBe(false)
	})
})
