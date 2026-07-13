'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Calculator, Calendar, CreditCard, Settings, Smile, User, LayoutDashboard, ListChecks, CheckSquare, KanbanSquare, TrendingUp, GraduationCap, Briefcase, BookOpen, Sparkles, Heart, Timer } from 'lucide-react'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import { useSettings } from '@/lib/settings-context'

export function CommandPalette() {
  const [open, setOpen] = React.useState(false)
  const router = useRouter()
  const { settings } = useSettings()

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    // Mobile has no keyboard for Cmd/Ctrl+K — reachable instead via a
    // "Buscar" button in the mobile section drawer's footer (same
    // dispatch-a-custom-event pattern mobile-nav.tsx already uses for
    // "open-notifications"). A floating FAB kept losing this fight to
    // whatever else was rendering in the same mobile corner (mobile-nav's
    // own FAB, then GeminiLiveOrb) — not worth relitigating per screen size.
    const openFromEvent = () => setOpen(true)

    document.addEventListener('keydown', down)
    window.addEventListener('open-command-palette', openFromEvent)
    return () => {
      document.removeEventListener('keydown', down)
      window.removeEventListener('open-command-palette', openFromEvent)
    }
  }, [])

  const runCommand = React.useCallback((command: () => unknown) => {
    setOpen(false)
    command()
  }, [])

  return (
    <>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Suggestions">
            <CommandItem onSelect={() => runCommand(() => router.push('/'))}>
              <LayoutDashboard className="mr-2 h-4 w-4" />
              <span>Dashboard</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push('/calendar'))}>
              <Calendar className="mr-2 h-4 w-4" />
              <span>Calendar</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push('/checklist'))}>
              <CheckSquare className="mr-2 h-4 w-4" />
              <span>Daily Checklist</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Modules">
            <CommandItem onSelect={() => runCommand(() => router.push('/routines'))}>
              <ListChecks className="mr-2 h-4 w-4" />
              <span>Routines</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push('/projects'))}>
              <KanbanSquare className="mr-2 h-4 w-4" />
              <span>Projects</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push('/trackers'))}>
              <TrendingUp className="mr-2 h-4 w-4" />
              <span>Trackers</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push('/school'))}>
              <GraduationCap className="mr-2 h-4 w-4" />
              <span>School</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push('/business'))}>
              <Briefcase className="mr-2 h-4 w-4" />
              <span>Business</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push('/library'))}>
              <BookOpen className="mr-2 h-4 w-4" />
              <span>Library</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push('/spiritual'))}>
              <Sparkles className="mr-2 h-4 w-4" />
              <span>Spiritual</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push('/appearance'))}>
              <Heart className="mr-2 h-4 w-4" />
              <span>Appearance</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Settings">
            <CommandItem onSelect={() => runCommand(() => router.push('/settings'))}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
              <CommandShortcut>⌘S</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
