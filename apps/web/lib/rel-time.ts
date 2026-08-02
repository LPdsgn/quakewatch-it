const rtf = new Intl.RelativeTimeFormat('it', { numeric: 'auto' })

/** Tempo relativo in italiano (es. "5 minuti fa") da un ISO time UTC a `nowMs` (epoch ms). */
export function relativeTime(isoTime: string, nowMs: number): string {
	const diffSec = Math.round((new Date(isoTime).getTime() - nowMs) / 1000)
	if (Math.abs(diffSec) < 60) return rtf.format(diffSec, 'second')
	const diffMin = Math.round(diffSec / 60)
	if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute')
	const diffHour = Math.round(diffMin / 60)
	if (Math.abs(diffHour) < 24) return rtf.format(diffHour, 'hour')
	return rtf.format(Math.round(diffHour / 24), 'day')
}
