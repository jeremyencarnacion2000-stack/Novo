import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckSquare, FolderKanban, Activity, Calendar } from 'lucide-react'
import Link from 'next/link'

const createActions = [
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
        <CardTitle className="subtitle-technical">Command Center</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Create Section */}
        <div className="space-y-4">
          <h3 className="subtitle-technical">Actions</h3>
          <div className="grid gap-3">
            {createActions.map((action) => {
              const Icon = action.icon
              return (
                <Button
                  key={action.title}
                  variant="ghost"
                  className="justify-between h-auto py-3 px-4 glass-card-list hover:!bg-foreground/[0.06] group transition-all duration-300"
                  asChild
                >
                  <Link href={action.href}>
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-foreground/5 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="font-semibold text-xs tracking-tight opacity-70 group-hover:opacity-100">{action.title}</span>
                    </div>
                    <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded-[6px] border border-foreground/5 bg-foreground/5 px-1.5 font-mono text-[9px] font-medium text-foreground/20 opacity-40 group-hover:opacity-100 transition-all">
                      {action.shortcut}
                    </kbd>
                  </Link>
                </Button>
              )
            })}
          </div>
        </div>

        {/* Register Section - Systemic Actions */}
        <div className="space-y-4">
          <h3 className="subtitle-technical">System logs</h3>
          <div className="grid gap-3">
            {registerActions.map((action) => {
              const Icon = action.icon
              const isProbable = action.title === 'Log Event'; // Corrected probability logic

              return (
                <Button
                  key={action.title}
                  variant="ghost"
                  className={`justify-between h-auto py-3 px-4 glass-card-list group transition-all duration-300 ${isProbable
                    ? 'border-primary/20 bg-primary/10 bloom-soft hover:bg-primary/20'
                    : 'hover:!bg-foreground/[0.06]'
                    }`}
                  asChild
                >
                  <Link href={action.href}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg transition-colors ${isProbable
                        ? 'bg-primary/20 text-primary group-hover:bg-primary/30 group-hover:opacity-80'
                        : 'bg-secondary/50 text-muted-foreground group-hover:bg-secondary group-hover:text-foreground'
                        }`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className={`font-semibold text-xs tracking-tight ${isProbable ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}`}>
                        {action.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isProbable && (
                        <span className="flex h-1.5 w-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_var(--primary-glow)]" />
                      )}
                      <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded-[6px] border border-foreground/10 bg-muted/30 px-1.5 font-mono text-[9px] font-medium text-muted-foreground opacity-40 group-hover:opacity-100 transition-opacity">
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
