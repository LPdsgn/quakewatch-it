import { SEMANTIC_TOKENS } from './semantic.ts'

const vars = (t: Record<string, string>) =>
	Object.entries(t)
		.map(([k, v]) => `\t--${k}: ${v};`)
		.join('\n')

/** Emette il CSS dei temi. theme-dark è anche :root (dark default, spec §3). */
export function generateThemeCss(): string {
	return (
		[
			'/* GENERATO da packages/tokens — NON EDITARE. `pnpm --filter @quakewatch/tokens build:css` */',
			`:root,\n.theme-dark {\n${vars(SEMANTIC_TOKENS['theme-dark'])}\n}`,
			`.theme-light {\n${vars(SEMANTIC_TOKENS['theme-light'])}\n}`,
		].join('\n\n') + '\n'
	)
}
