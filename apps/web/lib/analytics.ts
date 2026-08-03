import posthog from 'posthog-js'

const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST
let enabled = false
let initialized = false

export function enableAnalytics() {
	if (!token || !host) return
	if (!initialized) {
		posthog.init(token, {
			api_host: host,
			capture_exceptions: true,
			debug: process.env.NODE_ENV === 'development',
			defaults: '2026-01-30',
		})
		initialized = true
	} else {
		posthog.opt_in_capturing()
	}
	enabled = true
}

export function disableAnalytics() {
	enabled = false
	if (initialized) {
		posthog.reset()
		posthog.opt_out_capturing()
	}
}

export function capture(event: string, properties?: Record<string, unknown>) {
	if (enabled) posthog.capture(event, properties)
}

export function captureException(error: Error) {
	if (enabled) posthog.captureException(error)
}
