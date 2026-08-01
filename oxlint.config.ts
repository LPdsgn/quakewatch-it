import { defineConfig } from 'oxlint'

/**
 * Configurazione oxlint.
 *
 * File `.ts` invece di `.oxlintrc.json`: attenzione al nome, oxlint fa
 * auto-discovery di `oxlint.config.ts`, NON di `.oxlintrc.ts` — sbagliarlo
 * fa silenziosamente ricadere sui default, senza alcun avviso (verificato
 * empiricamente, vedi report Parte A).
 *
 * Set di regole adattato da darkroomengineering/satus: sottoinsieme
 * curato per lo stato attuale del repo (niente Link/Image custom, niente
 * Storybook/Sanity), non copia integrale.
 */
export default defineConfig({
  plugins: [
    'eslint',
    'typescript',
    'unicorn',
    'oxc',
    'react',
    'jsx-a11y',
    'nextjs',
    'import',
    'promise',
  ],
  categories: {
    correctness: 'error',
  },
  env: {
    browser: true,
    node: true,
    es2024: true,
  },

  // Niente `settings.react.linkComponents` / `settings['jsx-a11y'].components`
  // per ora: non esistono ancora componenti custom Link/Image da insegnare
  // al linter. Da rivalutare nel Piano 2, quando arriveranno.

  ignorePatterns: [
    'node_modules/**',
    '.next/**',
    'dist/**',
    'coverage/**',
    'next-env.d.ts',
    'packages/core/test/fixtures/**',
    '.superpowers/**',
    '.claude/**',
    '.agents/**',
    'docs/**',
  ],

  rules: {
    'eslint/no-unused-vars': [
      'error',
      {
        args: 'after-used',
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      },
    ],
    'eslint/eqeqeq': ['error', 'always', { null: 'ignore' }],
    'eslint/no-else-return': ['error', { allowElseIf: false }],
    'eslint/no-nested-ternary': 'error',
    'typescript/no-explicit-any': 'error',
    'typescript/prefer-as-const': 'error',
    'typescript/array-type': ['error', { default: 'array', readonly: 'array' }],
    'react/self-closing-comp': ['error', { html: true, component: true }],
    'unicorn/prefer-number-properties': [
      'error',
      { checkInfinity: true, checkNaN: true },
    ],
    'unicorn/new-for-builtins': 'error',
    'unicorn/filename-case': [
      'warn',
      {
        cases: { kebabCase: true, camelCase: true },
        multipleFileExtensions: true,
      },
    ],
    'unicorn/no-lonely-if': 'warn',
    'unicorn/prefer-array-flat-map': 'warn',

    // jsx-a11y: set completo di satus.
    'jsx-a11y/click-events-have-key-events': 'warn',
    'jsx-a11y/anchor-is-valid': 'warn',
    'jsx-a11y/alt-text': 'error',
    'jsx-a11y/aria-props': 'error',
    'jsx-a11y/aria-role': 'error',
    'jsx-a11y/aria-proptypes': 'error',
    'jsx-a11y/aria-unsupported-elements': 'error',
    'jsx-a11y/no-autofocus': 'warn',
    'jsx-a11y/no-distracting-elements': 'error',
    'jsx-a11y/img-redundant-alt': 'error',
    // Off in satus per via di <output role="status"> preesistenti nel loro
    // codebase (non applicabile qui). Tenuta off per parità di set finché
    // non emerge un caso reale da valutare.
    'jsx-a11y/prefer-tag-over-role': 'off',

    'nextjs/no-img-element': 'error',
    'import/first': 'error',
    'react/rules-of-hooks': 'error',
    'react/no-object-type-as-default-prop': 'error',
    'promise/no-return-in-finally': 'error',
    'oxc/no-accumulating-spread': 'warn',
    'unicorn/prefer-set-has': 'error',
    'unicorn/prefer-array-find': 'error',

    'eslint/no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: 'react',
            importNames: ['forwardRef'],
            message:
              'forwardRef è superfluo in React 19 col compiler - accetta `ref` come prop normale.',
          },
        ],
        patterns: [
          {
            regex: '^\\.\\./\\.\\./',
            message:
              'Usa import alias (@/dir/) invece di import relativi profondi (../../). Un solo livello (../) è ammesso per file collocati insieme (es. i test che importano da ../src/...).',
          },
        ],
      },
    ],

    // --- Regole type-aware (attive solo con `pnpm lint:types`, Parte B) ------
    'typescript/consistent-type-exports': 'error',
    'typescript/no-floating-promises': 'error',
    'typescript/no-misused-promises': 'error',

    // `--type-aware` accende tutte le regole type-aware della categoria
    // correctness, non solo le tre sopra. Questi extra sono segnale nuovo,
    // mai triagiato: spenti deliberatamente, da riaccendere uno alla volta
    // dopo un passaggio dedicato (vedi Parte B per l'esito del triage).
    'typescript/await-thenable': 'off',
    'typescript/restrict-template-expressions': 'off',
    'typescript/no-misused-spread': 'off',
    'typescript/no-base-to-string': 'off',
    'typescript/unbound-method': 'off',
    'typescript/no-duplicate-type-constituents': 'off',
  },

  overrides: [
    {
      files: ['**/*.tsx', '**/*.jsx'],
      rules: {
        'react/jsx-key': 'error',
        'jsx-a11y/anchor-is-valid': 'error',
        'jsx-a11y/click-events-have-key-events': 'error',
        'jsx-a11y/mouse-events-have-key-events': 'error',
      },
    },
    {
      files: ['**/*.ts', '**/*.tsx'],
      rules: {
        'typescript/consistent-type-imports': [
          'error',
          {
            prefer: 'type-imports',
            fixStyle: 'separate-type-imports',
            disallowTypeAnnotations: true,
          },
        ],
        'typescript/array-type': [
          'error',
          { default: 'array', readonly: 'array' },
        ],
        'eslint/no-undef': 'off',
      },
    },
  ],
})
