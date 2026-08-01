import { describe, expect, it } from 'vitest'

import { env } from '../lib/env'

describe('env', () => {
	it('INGV_BASE_URL ha un default valido', () => {
		expect(env.INGV_BASE_URL).toBe('https://webservices.ingv.it')
	})
})
