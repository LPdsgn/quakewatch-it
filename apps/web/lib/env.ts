import { z } from 'zod'

const schema = z.object({
	INGV_BASE_URL: z.string().url().default('https://webservices.ingv.it'),
})

/** Env validate al primo import: config rotta = crash all'avvio, non in produzione. */
export const env = schema.parse({
	INGV_BASE_URL: process.env.INGV_BASE_URL,
})
