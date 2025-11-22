'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Calculator, Calendar, CreditCard, Settings, Smile, User, LayoutDashboard, ListChecks, CheckSquare, KanbanSquare, TrendingUp, GraduationCap, Briefcase, BookOpen, Sparkles, Heart, Search, Timer } from 'lucide-react'

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

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const runCommand = React.useCallback((command: () => unknown) => {
    setOpen(false)
    command()
  }, [])

  return (
    <>
      <div 
        className="fixed bottom-4 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg md:hidden"
        onClick={() => setOpen(true)}
      >
        <Search className="h-5 w-5" />
      </div>
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
