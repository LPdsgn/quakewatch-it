import { NEUTRAL_DARK, NEUTRAL_LIGHT, RED, STATUS, TEXT_DARK, TEXT_LIGHT } from './palette.ts'

export const THEME_NAMES = ['theme-dark', 'theme-light'] as const
export type ThemeName = (typeof THEME_NAMES)[number]

type TextType = { readonly primary: string; readonly secondary: string }

function build(
	n: typeof NEUTRAL_DARK | typeof NEUTRAL_LIGHT,
	text: TextType
): Record<string, string> {
	const base = {
		background: n[900],
		foreground: text.primary,
		card: n[800],
		'card-foreground': text.primary,
		popover: n[700],
		'popover-foreground': text.primary,
		primary: RED[500],
		'primary-foreground': 'hsl(0 0% 100%)',
		secondary: n[700],
		'secondary-foreground': text.primary,
		muted: n[600],
		'muted-foreground': text.secondary,
		accent: n[600],
		'accent-foreground': text.primary,
		border: n[500],
		input: n[500],
		outline: RED[500],
		// Scrim overlay (drawer/dialog backdrop): resta scuro in entrambi i temi,
		// convenzione standard per gli overlay — l'alpha la applica la utility class.
		overlay: 'hsl(0 0% 0%)',
		error: STATUS.error,
		'error-foreground': 'hsl(0 0% 100%)',
		warning: STATUS.warning,
		'warning-foreground': 'hsl(45 100% 15%)',
		success: STATUS.success,
		'success-foreground': 'hsl(0 0% 100%)',
		info: STATUS.info,
		'info-foreground': 'hsl(205 80% 12%)',
		'sidebar-background': n[850],
		'sidebar-border': n[500],
		radius: '0.75rem',
	}

	// shadcn base-nova aliases (amendment)
	const aliases: Record<string, string> = {
		destructive: base.error,
		'destructive-foreground': base['error-foreground'],
		ring: base.outline,
		sidebar: base['sidebar-background'],
		'sidebar-foreground': base.foreground,
		'sidebar-primary': base.primary,
		'sidebar-primary-foreground': base['primary-foreground'],
		'sidebar-accent': base.accent,
		'sidebar-accent-foreground': base['accent-foreground'],
		'sidebar-ring': base.outline,
		'chart-1': n[600],
		'chart-2': n[500],
		'chart-3': n[700],
		'chart-4': n[800],
		'chart-5': n[850],
	}

	return { ...base, ...aliases }
}

export const SEMANTIC_TOKENS: Record<ThemeName, Record<string, string>> = {
	'theme-dark': build(NEUTRAL_DARK, TEXT_DARK),
	'theme-light': build(NEUTRAL_LIGHT, TEXT_LIGHT),
}
