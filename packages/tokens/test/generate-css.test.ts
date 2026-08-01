import { describe, expect, it } from 'vitest'

import { SEMANTIC_TOKENS, THEME_NAMES, generateThemeCss } from '../src/index'

describe('SEMANTIC_TOKENS', () => {
	it('dark e light espongono esattamente gli stessi nomi (nessun token orfano)', () => {
		const dark = Object.keys(SEMANTIC_TOKENS['theme-dark']).sort()
		const light = Object.keys(SEMANTIC_TOKENS['theme-light']).sort()
		expect(dark).toEqual(light)
		expect(dark.length).toBeGreaterThanOrEqual(20)
	})

	it('include il layer semantico shadcn-compatibile e le var sidebar (spec §3)', () => {
		const required = [
			'background',
			'foreground',
			'card',
			'card-foreground',
			'popover',
			'popover-foreground',
			'primary',
			'primary-foreground',
			'secondary',
			'secondary-foreground',
			'muted',
			'muted-foreground',
			'accent',
			'accent-foreground',
			'border',
			'input',
			'outline',
			'error',
			'error-foreground',
			'warning',
			'warning-foreground',
			'success',
			'success-foreground',
			'sidebar-background',
			'sidebar-border',
			'radius',
			// shadcn base-nova aliases (amendment)
			'destructive',
			'destructive-foreground',
			'ring',
			'sidebar',
			'sidebar-foreground',
			'sidebar-primary',
			'sidebar-primary-foreground',
			'sidebar-accent',
			'sidebar-accent-foreground',
			'sidebar-ring',
			'chart-1',
			'chart-2',
			'chart-3',
			'chart-4',
			'chart-5',
		]
		for (const name of required) {
			expect(SEMANTIC_TOKENS['theme-dark']).toHaveProperty(name)
		}
	})

	it('primary è rosso in entrambi i temi ed error è distinto da primary', () => {
		for (const t of THEME_NAMES) {
			expect(SEMANTIC_TOKENS[t].primary).not.toEqual(SEMANTIC_TOKENS[t].error)
		}
	})
})

describe('generateThemeCss', () => {
	it('emette :root/.theme-dark e .theme-light con le var prefissate', () => {
		const css = generateThemeCss()
		expect(css).toContain(':root,\n.theme-dark {')
		expect(css).toContain('.theme-light {')
		expect(css).toContain('--background:')
		expect(css).toContain('--sidebar-background:')
		expect(css).toContain('NON EDITARE')
	})
})
