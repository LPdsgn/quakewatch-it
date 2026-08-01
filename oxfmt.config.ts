import { defineConfig } from 'oxfmt'

/**
 * Configurazione oxfmt.
 *
 * File `.ts` invece di `.oxfmtrc.json`. Attenzione al nome: oxfmt fa
 * auto-discovery di `oxfmt.config.ts`, NON di `.oxfmtrc.ts`.
 *
 * House style satus: 80 colonne, indent 2 spazi, niente punti e virgola
 * salvo dove richiesti, apici singoli, trailing comma es5, LF. I default di
 * oxfmt differiscono (printWidth 100, semi true, singleQuote false,
 * trailingComma "all"), quindi ogni valore è esplicito.
 */
export default defineConfig({
	printWidth: 100,
	tabWidth: 3,
	useTabs: true,
	semi: false,
	singleQuote: true,
	trailingComma: 'es5',
	arrowParens: 'always',
	endOfLine: 'lf',
	// Non ri-wrappa la prosa Markdown: il diff resta su whitespace/tabelle
	// invece di un rewrite completo.
	proseWrap: 'preserve',

	// Entrambi i sorter sono off di default.
	sortImports: {
		groups: [
			'builtin',
			'external',
			['internal', 'subpath'],
			['parent', 'sibling', 'index'],
			'style',
			'unknown',
		],
		// Prefix list, non una regex: internalPattern è per un futuro alias @/.
		internalPattern: ['@/'],
		ignoreCase: true,
		sortSideEffects: false,
	},

	// sortTailwindcss: da attivare nel Piano 2, quando esisterà un file CSS di
	// token a cui puntare `stylesheet` (nessun class soup ancora da ordinare).

	// sortPackageJson è on di default; mantiene l'ordine curato a mano degli
	// script.
	sortPackageJson: {
		sortScripts: false,
	},

	ignorePatterns: [
		'node_modules/**',
		'.next/**',
		'dist/**',
		'pnpm-lock.yaml',
		'public/**',
		'packages/core/test/fixtures/**',
		'.superpowers/**',
		'.claude/**',
		'.agents/**',
		'docs/**',
	],
})
