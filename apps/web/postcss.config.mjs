/**
 * PostCSS preset-env config.
 * @see Docs {@link https://github.com/csstools/postcss-plugins/blob/main/plugin-packs/postcss-preset-env/README.md#options}
 * @see Features flags {@link https://github.com/csstools/postcss-plugins/blob/main/plugin-packs/postcss-preset-env/FEATURES.md}
 * @type {import('postcss-preset-env').pluginOptions}
 */
const presetEnvConfig = {
	autoprefixer: {
		flexbox: 'no-2009',
	},
	stage: 3,
	features: {
		'custom-properties': false,
		'custom-media-queries': true,
	},
}

const postcssConfig = {
	// NOTE: l'ordine conta. Tailwind genera l'utility CSS per prima;
	// preset-env va per ultimo perché processa/autoprefixa l'output finale,
	// incluso quello di Tailwind.
	plugins: {
		'@tailwindcss/postcss': {},

		// '@csstools/postcss-global-data' andrebbe qui (prima di preset-env),
		// per dare ai moduli CSS visibilità su @custom-media/@custom-selector
		// definiti altrove. NON attivo: non esiste ancora un file @custom-media
		// da referenziare. Attivare nel Piano 2 puntando al file generato da
		// packages/tokens.

		// NOTE: deve restare l'ultima voce.
		'postcss-preset-env': presetEnvConfig,
	},
}

export default postcssConfig
