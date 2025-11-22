import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, CheckSquare, FolderKanban, Activity } from 'lucide-react'
import Link from 'next/link'

const actions = [
  {
    title: 'New Routine',
    description: 'Create a new daily routine',
    icon: Plus,
    href: '/routines',
  },
  {
    title: 'Add Task',
    description: 'Add to daily checklist',
    icon: CheckSquare,
    href: '/checklist',
  },
  {
    title: 'New Project',
    description: 'Start a new project',
    icon: FolderKanban,
    href: '/projects',
  },
  {
    title: 'Log Activity',
    description: 'Track a habit or metric',
    icon: Activity,
    href: '/trackers',
  },
]

export function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2">
          {actions.map((action) => {
            const Icon = action.icon
            return (
              <Button
                key={action.title}
                variant="outline"
                className="justify-start h-auto py-3"
                asChild
              >
                <Link href={action.href}>
                  <Icon className="h-4 w-4 mr-3" />
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{action.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {action.description}
                    </span>
                  </div>
                </Link>
              </Button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
