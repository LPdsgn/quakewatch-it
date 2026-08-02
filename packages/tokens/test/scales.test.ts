import { describe, expect, it } from 'vitest'

import {
	MAGNITUDE_CLASSES,
	MAGNITUDE_COLORS,
	MMI_SCALE,
	SEMANTIC_TOKENS,
	THEME_NAMES,
	magnitudeClassOf,
} from '../src/index'

describe('MAGNITUDE_CLASSES', () => {
	it('4 classi contigue in ordine (max di una = min della successiva)', () => {
		expect(MAGNITUDE_CLASSES).toHaveLength(4)
		expect(MAGNITUDE_CLASSES.map((c) => c.id)).toEqual(['m0', 'm2', 'm3', 'm4'])
		for (let i = 0; i < MAGNITUDE_CLASSES.length - 1; i++) {
			expect(MAGNITUDE_CLASSES[i]?.max).toBe(MAGNITUDE_CLASSES[i + 1]?.min)
		}
		expect(MAGNITUDE_CLASSES.at(-1)?.max).toBeNull()
	})
})

describe('magnitudeClassOf', () => {
	it.each([
		[-1, 'm0'],
		[0, 'm0'],
		[1.99, 'm0'],
		[2, 'm2'],
		[2.99, 'm2'],
		[3, 'm3'],
		[3.99, 'm3'],
		[4, 'm4'],
		[6.5, 'm4'],
	])('magnitudo %s → classe %s', (magnitude, expectedId) => {
		expect(magnitudeClassOf(magnitude).id).toBe(expectedId)
	})
})

describe('MAGNITUDE_COLORS', () => {
	it('un colore per OGNI classe in ENTRAMBI i temi (parità nomi)', () => {
		const classIds = MAGNITUDE_CLASSES.map((c) => c.id).sort()
		for (const theme of THEME_NAMES) {
			expect(Object.keys(MAGNITUDE_COLORS[theme]).sort()).toEqual(classIds)
		}
	})

	it('nessuna classe usa lo stesso identico valore di --primary (brand riconoscibile)', () => {
		for (const theme of THEME_NAMES) {
			const primary = SEMANTIC_TOKENS[theme].primary
			for (const color of Object.values(MAGNITUDE_COLORS[theme])) {
				expect(color).not.toEqual(primary)
			}
		}
	})
})

describe('MMI_SCALE', () => {
	it('10 step, valori 1..10, colori identici nei due temi (standard di dominio fisso)', () => {
		expect(MMI_SCALE).toHaveLength(10)
		expect(MMI_SCALE.map((s) => s.value)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
		for (const step of MMI_SCALE) {
			expect(step.label.length).toBeGreaterThan(0)
			expect(step.color).toMatch(/^#[0-9a-fA-F]{6}$/)
		}
	})
})
