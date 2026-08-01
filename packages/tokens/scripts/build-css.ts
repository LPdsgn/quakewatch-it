import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { generateThemeCss } from '../src/generate-css.ts'

const out = fileURLToPath(new URL('../../../apps/web/app/theme.css', import.meta.url))
writeFileSync(out, generateThemeCss())
console.log(`scritto ${out}`)
