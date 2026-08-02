import type { ThemeName } from '@quakewatch/tokens'

/** next-themes `resolvedTheme` → ThemeName dei token. Usare con mounted-guard: undefined in SSR. */
export function toThemeName(resolvedTheme: string | undefined): ThemeName {
	return resolvedTheme === 'light' ? 'theme-light' : 'theme-dark'
}
