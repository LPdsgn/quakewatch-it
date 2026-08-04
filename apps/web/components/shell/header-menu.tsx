'use client'

import { EllipsisVertical, ExternalLink } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'

import { setAnalyticsConsent, useAnalyticsConsent } from '@/components/cookie-consent-banner'
import { Button } from '@/components/ui/button'
import {
	Drawer,
	DrawerContent,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from '@/components/ui/drawer'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { useIsMobile } from '@/hooks/use-mobile'
import { usePersistentPref } from '@/hooks/use-persistent-pref'
import { capture } from '@/lib/analytics'
import { type Variant } from '@/lib/url-state'

const INGV_URL = 'https://terremoti.ingv.it'

/** Voci condivise tra le due rese (dropdown desktop, drawer mobile): scaffold per opzioni future. */
interface MenuEntry {
	label: string
	icon: ComponentType<SVGProps<SVGSVGElement>>
	href?: string
	disabled?: boolean
}

const MENU_ENTRIES: MenuEntry[] = [{ label: 'Dati INGV', icon: ExternalLink, href: INGV_URL }]

/**
 * Menu opzioni dell'header: dropdown su desktop, drawer modale su mobile.
 * Il primo render (useIsMobile non ancora assestato) mostra la variante desktop
 * a menu chiuso: nessun impatto visibile.
 */
export function HeaderMenu() {
	const isMobile = useIsMobile()
	return isMobile ? <MobileMenu /> : <DesktopMenu />
}

/**
 * Base UI (render prop) clona l'elemento e gli passa children (icona) e handler:
 * l'elemento nel render DEVE fare spread delle props — Button lo fa internamente.
 * Un wrapper senza spread ingoia icona e onClick (bug: menu invisibile e non apribile).
 */
const menuTriggerButton = (
	<Button type="button" variant="outline" size="icon" aria-label="Apri menu" />
)

/**
 * Il controllo variante legge/scrive la preferenza da localStorage (non più URL):
 * è una preferenza, non una view (AGENTS.md — Scelte chiuse). Sync cross-component
 * via usePersistentPref (header-menu + home-client condividono la stessa key).
 */
function useVariantControl() {
	const [variant, setVariant] = usePersistentPref<Variant>('variant', 'default')
	return { variant, setVariant }
}

function DesktopMenu() {
	const { variant, setVariant } = useVariantControl()
	const analyticsEnabled = useAnalyticsConsent()
	return (
		<DropdownMenu>
			<DropdownMenuTrigger render={menuTriggerButton}>
				<EllipsisVertical />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" side="inline-end" sideOffset={21} className="min-w-44">
				{/* Base UI: GroupLabel DEVE stare dentro Group/RadioGroup (MenuGroupContext). */}
				<DropdownMenuRadioGroup
					value={variant}
					onValueChange={(next) => setVariant(next as Variant)}
				>
					<DropdownMenuLabel>Dettaglio evento</DropdownMenuLabel>
					<DropdownMenuRadioItem value="default">A · sidebar</DropdownMenuRadioItem>
					<DropdownMenuRadioItem value="detail-float">B · float</DropdownMenuRadioItem>
				</DropdownMenuRadioGroup>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					render={
						<div
							className="flex w-full items-center justify-between gap-4"
							onPointerDown={(e) => e.stopPropagation()}
						>
							Cookie analitici
							<Switch checked={analyticsEnabled} onCheckedChange={setAnalyticsConsent} />
						</div>
					}
				/>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuLabel>Crediti</DropdownMenuLabel>
					{MENU_ENTRIES.map((entry) =>
						entry.href ? (
							<DropdownMenuItem
								key={entry.label}
								render={
									<a
										href={entry.href}
										onClick={() => capture('ingv_data_opened')}
										target="_blank"
										rel="noopener noreferrer"
									>
										<entry.icon /> {entry.label}
									</a>
								}
							/>
						) : (
							<DropdownMenuItem key={entry.label} disabled={entry.disabled}>
								<entry.icon /> {entry.label}
							</DropdownMenuItem>
						)
					)}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

function MobileMenu() {
	const analyticsEnabled = useAnalyticsConsent()

	return (
		<Drawer>
			<DrawerTrigger render={menuTriggerButton}>
				<EllipsisVertical />
			</DrawerTrigger>
			<DrawerContent aria-label="Menu opzioni">
				<DrawerHeader>
					<DrawerTitle>Opzioni</DrawerTitle>
				</DrawerHeader>
				<div className="flex flex-col gap-1 p-4 pt-2 pb-[max(env(safe-area-inset-bottom),1rem)]">
					<div className="flex items-center justify-between gap-4 rounded-lg px-2 py-2.5 text-sm text-foreground hover:bg-muted">
						Cookie analitici
						<Switch checked={analyticsEnabled} onCheckedChange={setAnalyticsConsent} />
					</div>
					{MENU_ENTRIES.map((entry) => {
						const content = (
							<>
								<entry.icon className="size-4 text-muted-foreground" />
								{entry.label}
							</>
						)
						return entry.href ? (
							<a
								key={entry.label}
								href={entry.href}
								onClick={() => capture('ingv_data_opened')}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-2 rounded-lg px-2 py-2.5 text-sm text-foreground hover:bg-muted"
							>
								{content}
							</a>
						) : (
							<button
								key={entry.label}
								type="button"
								disabled={entry.disabled}
								className="flex items-center gap-2 rounded-lg px-2 py-2.5 text-left text-sm text-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
							>
								{content}
							</button>
						)
					})}
				</div>
			</DrawerContent>
		</Drawer>
	)
}
