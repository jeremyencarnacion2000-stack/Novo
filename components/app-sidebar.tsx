'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ListChecks, CheckSquare, KanbanSquare, TrendingUp, Settings, GraduationCap, Briefcase, BookOpen, Sparkles, Heart, Calendar, Bot, Music, LogOut, User, BarChart3 } from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { FocusMode } from '@/components/focus-mode'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'

const navigation = [
  {
    title: 'Overview',
    items: [
      {
        title: 'Dashboard',
        href: '/',
        icon: LayoutDashboard,
      },
      {
        title: 'Analytics',
        href: '/analytics',
        icon: BarChart3,
      },
      {
        title: 'Calendar',
        href: '/calendar',
        icon: Calendar,
      },
      {
        title: 'AI Assistant',
        href: '/ai',
        icon: Bot,
      },
    ],
  },
  {
    title: 'Productivity',
    items: [
      {
        title: 'Routines',
        href: '/routines',
        icon: ListChecks,
      },
      {
        title: 'Daily Checklist',
        href: '/checklist',
        icon: CheckSquare,
      },
      {
        title: 'Projects',
        href: '/projects',
        icon: KanbanSquare,
      },
      {
        title: 'Trackers',
        href: '/trackers',
        icon: TrendingUp,
      },
    ],
  },
  {
    title: 'Life & Growth',
    items: [
      {
        title: 'School',
        href: '/school',
        icon: GraduationCap,
      },
      {
        title: 'Novo Business',
        href: '/business',
        icon: Briefcase,
      },
      {
        title: 'Reading Library',
        href: '/library',
        icon: BookOpen,
      },
      {
        title: 'Spiritual',
        href: '/spiritual',
        icon: Sparkles,
      },
      {
        title: 'Appearance',
        href: '/appearance',
        icon: Heart,
      },
      {
        title: 'Music',
        href: '/music',
        icon: Music,
      },
    ],
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <span className="text-sm font-bold">N</span>
          </div>
          <div>
            <h2 className="text-lg font-bold leading-none">Novo</h2>
            <p className="text-xs text-muted-foreground">Productivity Hub</p>
          </div>
        </div>
        {session?.user && (
          <div className="mt-4 flex items-center gap-3 px-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={session.user.image || ''} />
              <AvatarFallback>
                {session.user.name?.charAt(0) || session.user.email?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{session.user.name || 'User'}</p>
              <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>
            </div>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        {navigation.map((section) => (
          <SidebarGroup key={section.title}>
            <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.title}
                      >
                        <Link href={item.href}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center justify-between mb-2 px-2">
          <span className="text-xs font-medium text-muted-foreground">Tools</span>
          <FocusMode />
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Profile">
              <Link href="/profile">
                <User className="h-4 w-4" />
                <span>Profile</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Settings">
              <Link href="/settings">
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {session && (
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                tooltip="Sign Out"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
