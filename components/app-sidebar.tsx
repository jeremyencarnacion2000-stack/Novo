'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { LayoutDashboard, ListChecks, CheckSquare, KanbanSquare, TrendingUp, Settings, GraduationCap, Briefcase, BookOpen, Sparkles, Heart, Calendar, Bot, Music, LogOut, User, BarChart3, Timer } from 'lucide-react'
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
  useSidebar,
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
        title: 'Today',
        href: '/today',
        icon: Calendar,
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
      {
        title: 'Focus Mode',
        href: '/focus',
        icon: Timer,
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
    title: 'Life &amp; Growth',
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
  const { isMobile, setOpenMobile } = useSidebar()

  // Close sidebar on mobile after navigation
  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }

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
                        <Link href={item.href} onClick={handleLinkClick}>
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
            <SidebarMenuButton asChild tooltip="Profile" className="h-12">
              <Link href="/profile" className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={session?.user?.image || ''} alt={session?.user?.name || 'User'} />
                  <AvatarFallback>{session?.user?.name?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start text-sm">
                  <span className="font-medium">{session?.user?.name || 'User'}</span>
                  <span className="text-xs text-muted-foreground truncate max-w-[120px]">{session?.user?.email}</span>
                </div>
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
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Log out">
              <Link href="/api/auth/signout">
                <LogOut className="h-4 w-4" />
                <span>Log out</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
