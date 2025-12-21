'use client'

import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { LayoutDashboard, ListChecks, CheckSquare, KanbanSquare, TrendingUp, Settings, GraduationCap, Briefcase, BookOpen, Sparkles, Heart, Calendar, Bot, Music, LogOut, User, BarChart3, Timer, PanelLeft } from 'lucide-react'
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
  SidebarRail,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { FocusMode } from '@/components/focus-mode'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'

import { useTranslation } from '@/lib/i18n'

export function AppSidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { isMobile, setOpenMobile, state, toggleSidebar } = useSidebar()
  const { t } = useTranslation()

  const navigation = [
    {
      title: t('sidebar.overview'),
      items: [
        {
          title: t('sidebar.dashboard'),
          href: '/',
          icon: LayoutDashboard,
        },
        {
          title: t('sidebar.today'),
          href: '/today',
          icon: Calendar,
        },
        {
          title: t('sidebar.analytics'),
          href: '/analytics',
          icon: BarChart3,
        },
        {
          title: t('sidebar.calendar'),
          href: '/calendar',
          icon: Calendar,
        },
        {
          title: t('sidebar.ai'),
          href: '/ai',
          icon: Bot,
        },
        {
          title: t('sidebar.focus'),
          href: '/focus',
          icon: Timer,
        },
      ],
    },
    {
      title: t('sidebar.productivity'),
      items: [
        {
          title: t('sidebar.routines'),
          href: '/routines',
          icon: ListChecks,
        },
        {
          title: t('sidebar.checklist'),
          href: '/checklist',
          icon: CheckSquare,
        },
        {
          title: t('sidebar.projects'),
          href: '/projects',
          icon: KanbanSquare,
        },
        {
          title: t('sidebar.trackers'),
          href: '/trackers',
          icon: TrendingUp,
        },
      ],
    },
    {
      title: t('sidebar.life_growth'),
      items: [
        {
          title: t('sidebar.school'),
          href: '/school',
          icon: GraduationCap,
        },
        {
          title: t('sidebar.business'),
          href: '/business',
          icon: Briefcase,
        },
        {
          title: t('sidebar.library'),
          href: '/library',
          icon: BookOpen,
        },
        {
          title: t('sidebar.spiritual'),
          href: '/spiritual',
          icon: Sparkles,
        },
        {
          title: t('sidebar.appearance'),
          href: '/appearance',
          icon: Heart,
        },
        {
          title: t('sidebar.music'),
          href: '/music',
          icon: Music,
        },
      ],
    },
  ]


  // Close sidebar on mobile after navigation
  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  return (
    <Sidebar collapsible="icon" variant="floating" className="!h-[calc(100vh-2rem)] !m-4 !rounded-[40px] border-0 bg-transparent shadow-none [&>[data-sidebar=sidebar]]:!rounded-[40px] [&>[data-sidebar=sidebar]]:!bg-transparent [&>[data-sidebar=sidebar]]:!border-0 [&>[data-sidebar=sidebar]]:!shadow-none">
      <div className="h-full w-full glass-sidebar rounded-[40px] flex flex-col overflow-hidden shadow-xl">
        <SidebarHeader className="px-6 py-8 flex justify-center">
          <div className={cn("flex items-center justify-center transition-all duration-300", state === 'collapsed' ? 'w-10' : 'w-full')}>
            <div
              onClick={() => {
                if (isMobile) setOpenMobile(false)
                else {
                  toggleSidebar()
                }
              }}
              className="group relative flex items-center justify-center cursor-pointer"
            >
              <div className="transition-all duration-300 group-hover:opacity-0 group-hover:scale-90">
                <Image
                  src="/icon.svg"
                  alt="Novo"
                  width={state === 'expanded' ? 32 : 24}
                  height={state === 'expanded' ? 32 : 24}
                  className="object-contain"
                  priority
                />
              </div>
              <div className="absolute inset-0 flex items-center justify-center opacity-0 scale-90 transition-all duration-300 group-hover:opacity-100 group-hover:scale-100">
                <PanelLeft className="h-5 w-5 text-foreground" />
              </div>
              {state === 'expanded' && (
                <span className="ml-3 text-lg font-bold tracking-tight transition-opacity duration-300 group-hover:opacity-50">Novo</span>
              )}
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className={cn("py-2 transition-all duration-300", state === 'collapsed' ? "!px-0" : "px-3")}>
          {navigation.map((section) => (
            <SidebarGroup key={section.title} className={cn(state === 'collapsed' && "!p-0")}>
              {state === 'expanded' && (
                <SidebarGroupLabel className="px-4 text-[10px] font-bold tracking-widest text-muted-foreground/50 uppercase mb-2">
                  {section.title}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu className="gap-2">
                  {section.items.map((item) => {
                    const isActive = pathname === item.href
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={item.title}
                          className={cn(
                            "rounded-full transition-all duration-300 ease-out h-10",
                            state === 'collapsed' ? "!justify-center !px-0 !w-10 !mx-auto" : "px-4",
                            isActive
                              ? "sidebar-active-item"
                              : "text-muted-foreground hover:text-foreground hover:bg-white/[0.02]",
                          )}
                        >
                          <Link href={item.href} onClick={handleLinkClick} className={cn("flex items-center gap-3", state === 'collapsed' && "justify-center")}>
                            <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                            {state === 'expanded' && <span className="text-sm">{item.title}</span>}
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

        <SidebarFooter className={cn("mt-auto transition-all duration-300", state === 'collapsed' ? "p-2" : "p-4")}>
          <div className="glass-card rounded-[24px] p-2 flex flex-col gap-1">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Profile" className={cn("rounded-full h-10 transition-all duration-300 hover:bg-white/10", state === 'collapsed' ? "!justify-center !w-10 !mx-auto !px-0" : "px-2")}>
                  <Link href="/profile" className="flex items-center gap-3">
                    <Avatar className="h-8 w-8 border border-white/10">
                      <AvatarImage src={session?.user?.image || ''} alt={session?.user?.name || 'User'} />
                      <AvatarFallback className="bg-primary/20 text-primary text-xs">{session?.user?.name?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                    </Avatar>
                    {state === 'expanded' && (
                      <div className="flex flex-col items-start text-sm overflow-hidden min-w-0">
                        <span className="font-semibold truncate w-full text-xs">{session?.user?.name || 'User'}</span>
                      </div>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip={t('sidebar.settings')} className={cn("rounded-full h-10 hover:bg-white/10 transition-all duration-300", state === 'collapsed' ? "!justify-center !w-10 !mx-auto !px-0" : "px-3")}>
                  <Link href="/settings" className="flex items-center gap-3">
                    <Settings className="h-4 w-4" />
                    {state === 'expanded' && <span className="text-xs">{t('sidebar.settings')}</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </div>
    </Sidebar>
  )
}
