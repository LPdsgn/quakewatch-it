import type { Earthquake } from '@quakewatch/core'

/** I `count` eventi più forti (magnitudo desc, a parità il più recente) — pane "I più forti". */
export function topByMagnitude(events: Earthquake[], count = 4): Earthquake[] {
	return events
		.toSorted((a, b) => b.magnitude - a.magnitude || b.time.localeCompare(a.time))
		.slice(0, count)
}
