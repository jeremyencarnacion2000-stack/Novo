import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, CheckSquare, FolderKanban, Activity, Dumbbell, Calendar } from 'lucide-react'
import Link from 'next/link'

const createActions = [
  {
    title: 'New Routine',
    icon: Plus,
    href: '/routines',
    shortcut: '⌘R'
  },
  {
    title: 'Add Task',
    icon: CheckSquare,
    href: '/checklist',
    shortcut: '⌘T'
  },
  {
    title: 'New Project',
    icon: FolderKanban,
    href: '/projects',
    shortcut: '⌘P'
  }
]

const registerActions = [
  {
    title: 'Log Activity',
    icon: Activity,
    href: '/trackers',
    shortcut: '⌘L'
  },
  {
    title: 'Start Workout',
    icon: Dumbbell,
    href: '/workout',
    shortcut: '⌘W'
  },
  {
    title: 'Log Event',
    icon: Calendar,
    href: '/calendar',
    shortcut: '⌘E'
  }
]

export function QuickActions() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Command Center</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Create Section */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground/70 px-1">CREATE</h3>
          <div className="grid gap-2">
            {createActions.map((action) => {
              const Icon = action.icon
              return (
                <Button
                  key={action.title}
                  variant="ghost"
                  className="justify-between h-auto py-2 px-3 hover:bg-secondary/50 group"
                  asChild
                >
                  <Link href={action.href}>
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-md bg-secondary text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="font-medium text-sm">{action.title}</span>
                    </div>
                    <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity">
                      {action.shortcut}
                    </kbd>
                  </Link>
                </Button>
              )
            })}
          </div>
        </div>

        {/* Register Section - Systemic Actions */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground/70 px-1 flex items-center gap-2">
            SYSTEMIC <span className="h-px flex-1 bg-border/50"></span>
          </h3>
          <div className="grid gap-2">
            {registerActions.map((action) => {
              const Icon = action.icon
              const isProbable = action.title === 'Start Workout'; // Simulated prediction

              return (
                <Button
                  key={action.title}
                  variant="ghost"
                  className={`justify-between h-auto py-2 px-3 group transition-all duration-300 ${isProbable
                    ? 'bg-indigo-500/10 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.15)] hover:bg-indigo-500/20'
                    : 'hover:bg-secondary/50 border border-transparent'
                    }`}
                  asChild
                >
                  <Link href={action.href}>
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-md transition-colors ${isProbable
                        ? 'bg-indigo-500/20 text-indigo-400 group-hover:bg-indigo-500/30 group-hover:text-indigo-300'
                        : 'bg-secondary/80 text-muted-foreground group-hover:bg-secondary group-hover:text-foreground'
                        }`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className={`font-medium text-sm ${isProbable ? 'text-indigo-100' : 'text-muted-foreground group-hover:text-foreground'}`}>
                        {action.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isProbable && (
                        <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse-cognitive shadow-[0_0_5px_rgba(99,102,241,0.8)]" />
                      )}
                      <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted/50 px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity">
                        {action.shortcut}
                      </kbd>
                    </div>
                  </Link>
                </Button>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
