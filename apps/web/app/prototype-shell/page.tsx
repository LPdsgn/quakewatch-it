// PROTOTIPO USA-E-GETTA — valida proporzioni/densità della shell. Da eliminare dopo il verdetto (vedi NOTES.md).
import localFont from 'next/font/local'

import { PrototypeShell } from './prototype-shell'

const fontSans = localFont({
	src: [
		{ path: '../../assets/fonts/InterVariable.woff2', weight: '100 900', style: 'normal' },
		{ path: '../../assets/fonts/InterVariable-Italic.woff2', weight: '100 900', style: 'italic' },
	],
	variable: '--font-sans',
	display: 'swap',
	fallback: ['system-ui', 'arial'],
})

const fontMono = localFont({
	src: [
		{ path: '../../assets/fonts/JetBrains-Mono-VF.woff2', weight: '100 800', style: 'normal' },
	],
	variable: '--font-mono',
	display: 'swap',
	fallback: ['ui-monospace', 'monospace'],
})

export default function PrototypeShellPage() {
	return (
		<PrototypeShell fontSansVariable={fontSans.variable} fontMonoVariable={fontMono.variable} />
	)
}
