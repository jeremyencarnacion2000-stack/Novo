'use client'

import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { LayoutDashboard, ListChecks, CheckSquare, KanbanSquare, TrendingUp, Settings, GraduationCap, Briefcase, BookOpen, Sparkles, Heart, Calendar, CalendarRange, Sun, Bot, Music, LogOut, LogIn, User, BarChart3, Timer, PanelLeft, Brain } from 'lucide-react'
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
import { useSettings } from '@/lib/settings-context'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { SmoothScrollProvider } from '@/components/smooth-scroll-provider'
import { useRef } from 'react'


import { safeViewTransition } from '@/hooks/use-view-transition'

import { useCognitiveTwin } from '@/lib/cognitive-twin-context'

export function AppSidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { isMobile, setOpenMobile, state, toggleSidebar } = useSidebar()
  const { t } = useTranslation()
  const { isSettingsOpen, setSettingsOpen } = useSettings()
  const sidebarContentRef = useRef<HTMLDivElement>(null)
  const { twin } = useCognitiveTwin()

  const [isOnline, setIsOnline] = React.useState(true)

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine)
      const handleOnline = () => setIsOnline(true)
      const handleOffline = () => setIsOnline(false)
      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)
      return () => {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
      }
    }
  }, [])


  const rawNavigation = [
    {
      title: t('sidebar.overview'),
      items: [
        { title: t('sidebar.dashboard'), href: '/', icon: LayoutDashboard },
        { title: t('sidebar.today'), href: '/today', icon: Sun },
        { title: t('sidebar.analytics'), href: '/analytics', icon: BarChart3 },
        { title: t('sidebar.calendar'), href: '/calendar', icon: CalendarRange },
        { title: t('sidebar.ai'), href: '/ai', icon: Bot },
        { title: 'Cognitive Engine', href: '/cognitive', icon: Brain },
        { title: t('sidebar.focus'), href: '/focus', icon: Timer },
      ],
    },
    {
      title: t('sidebar.productivity'),
      items: [
        { title: t('sidebar.routines'), href: '/routines', icon: ListChecks },
        { title: t('sidebar.checklist'), href: '/checklist', icon: CheckSquare },
        { title: t('sidebar.projects'), href: '/projects', icon: KanbanSquare },
        { title: t('sidebar.trackers'), href: '/trackers', icon: TrendingUp },
      ],
    },
    {
      title: 'Contexto Vital',
      items: [
        { title: t('sidebar.school'), href: '/school', icon: GraduationCap },
        { title: t('sidebar.business'), href: '/business', icon: Briefcase },
        { title: t('sidebar.library'), href: '/library', icon: BookOpen },
        { title: t('sidebar.spiritual'), href: '/spiritual', icon: Sparkles },
        { title: t('sidebar.appearance'), href: '/appearance', icon: Heart },
        { title: t('sidebar.music'), href: '/music', icon: Music },
      ],
    },
  ]

  // Filter, sort, and group items dynamically based on Cognitive Twin initialized state
  const navigation = React.useMemo(() => {
    const enabledModules = twin.workspaceLayout?.enabledModules || ['today', 'ai', 'cognitive', 'focus']
    const pinnedModules = twin.workspaceLayout?.pinnedModules || []

    const filteredGroups = rawNavigation.map((group) => {
      const items = group.items.filter((item) => {
        // Core dashboard items always visible
        const coreHrefs = ['/', '/today', '/analytics', '/calendar', '/ai', '/cognitive', '/focus']
        if (coreHrefs.includes(item.href)) return true
        
        const moduleKey = item.href.replace('/', '')
        return enabledModules.includes(moduleKey)
      })

      // Sort items based on their order in enabledModules
      const sortedItems = [...items].sort((a, b) => {
        const coreHrefs = ['/', '/today', '/analytics', '/calendar', '/ai', '/cognitive', '/focus']
        const aIsCore = coreHrefs.includes(a.href)
        const bIsCore = coreHrefs.includes(b.href)
        
        if (aIsCore && bIsCore) return coreHrefs.indexOf(a.href) - coreHrefs.indexOf(b.href)
        if (aIsCore) return -1
        if (bIsCore) return 1
        
        const keyA = a.href.replace('/', '')
        const keyB = b.href.replace('/', '')
        
        return enabledModules.indexOf(keyA) - enabledModules.indexOf(keyB)
      })

      return {
        ...group,
        items: sortedItems
      }
    }).filter(group => group.items.length > 0)

    if (pinnedModules.length > 0) {
      const allItems = rawNavigation.flatMap(g => g.items)
      const pinnedItems = pinnedModules
        .map(id => allItems.find(item => item.href.replace('/', '') === id || (id === 'today' && item.href === '/today')))
        .filter(Boolean) as typeof allItems

      if (pinnedItems.length > 0) {
        filteredGroups.unshift({
          title: t('sidebar.pinned') || 'Favoritos',
          items: pinnedItems
        })
      }
    }

    return filteredGroups
  }, [twin.workspaceLayout?.enabledModules, twin.workspaceLayout?.pinnedModules, rawNavigation, t])

  const handleLinkClick = () => {
    if (isMobile) setOpenMobile(false)
  }

  return (
    <Sidebar
      collapsible="icon"
      variant="floating"
      className={cn(
        "border-0 bg-transparent shadow-none transition-[width,transform] duration-300",
        "md:!h-[calc(100vh-2rem)] md:!m-4",
        "is-mobile:!h-full is-mobile:!m-0",
        "[&>[data-sidebar=sidebar]]:!bg-transparent [&>[data-sidebar=sidebar]]:!border-0 [&>[data-sidebar=sidebar]]:!shadow-none",
        isMobile ? "w-[280px]" : ""
      )}
    >
      <div className={cn(
        "h-full w-full flex flex-col overflow-hidden transition-[border-radius] duration-300",
        isMobile ? "rounded-none" : "rounded-[40px]"
      )}>
        <SidebarHeader className={cn("py-8 flex justify-center transition-[padding] duration-300", state === 'collapsed' ? "!px-0" : "px-6")}>
          <div className={cn("flex items-center justify-center transition-[width] duration-300", state === 'collapsed' ? 'w-full' : 'w-full')}>
            <div
              onClick={() => {
                if (isMobile) setOpenMobile(false)
                else { toggleSidebar() }
              }}
              className="group relative flex items-center justify-center cursor-pointer"
            >
              <div className="transition-all duration-300 group-hover:opacity-0 group-hover:scale-90">
                <Image src="/icon.svg" alt="Novo" width={state === 'expanded' ? 32 : 24} height={state === 'expanded' ? 32 : 24} className="object-contain" priority />
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

        <SmoothScrollProvider scrollRef={sidebarContentRef}>
          <SidebarContent ref={sidebarContentRef} className={cn("py-2 transition-all duration-300", state === 'collapsed' ? "!px-0" : "px-3")}>
            {navigation.map((section) => (
              <Collapsible key={section.title} defaultOpen className="group/collapsible">
                <SidebarGroup className={cn(state === 'collapsed' && "!p-0")}>
                  {state === 'expanded' && (
                    <CollapsibleTrigger asChild>
                      <SidebarGroupLabel className="px-4 text-[10px] font-black tracking-[0.3em] uppercase opacity-60 mb-2 cursor-pointer hover:opacity-100 transition-opacity flex items-center justify-between w-full group-data-[state=open]/collapsible:opacity-100 group-data-[state=open]/collapsible:mb-4">
                        {section.title}
                        <ChevronDown className="h-3.5 w-3.5 transition-transform duration-500 group-data-[state=closed]/collapsible:-rotate-90 opacity-40 group-hover:opacity-100" />
                      </SidebarGroupLabel>
                    </CollapsibleTrigger>
                  )}
                  <CollapsibleContent className="data-[state=closed]:animate-none overflow-hidden">
                    <motion.div
                      initial={false}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      <SidebarGroupContent>
                        <SidebarMenu className="gap-2">
                          {section.items.map((item) => {
                            const isActive = pathname === item.href
                            return (
                              <SidebarMenuItem key={item.title}>
                                <motion.div
                                  whileHover={{ scale: 1.015 }}
                                  whileTap={{ scale: 0.97 }}
                                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                >
                                <SidebarMenuButton
                                  asChild
                                  isActive={isActive}
                                  tooltip={item.title}
                                  className={cn(
                                    "rounded-full transition-[background-color,color,box-shadow,width,padding] duration-200 ease-out h-10",
                                    state === 'collapsed' ? "!justify-center !px-0 !w-10 !mx-auto" : "px-4",
                                    isActive
                                      ? "sidebar-active-item"
                                      : "text-foreground/40 hover:text-foreground/80 hover:bg-foreground/[0.04]",
                                  )}
                                >
                                  <Link href={item.href} onClick={handleLinkClick} className={cn("flex items-center gap-3", state === 'collapsed' && "justify-center")}>
                                    <item.icon className={cn("h-5 w-5 shrink-0 transition-transform group-hover:scale-110", isActive ? "text-primary" : "text-foreground/40")} />
                                    {state === 'expanded' && <span className={cn("text-sm tracking-tight transition-all duration-200", isActive ? "font-semibold text-foreground" : "font-medium text-foreground/60")}>{item.title}</span>}
                                  </Link>
                                </SidebarMenuButton>
                                </motion.div>
                              </SidebarMenuItem>
                            )
                          })}
                        </SidebarMenu>
                      </SidebarGroupContent>
                    </motion.div>
                  </CollapsibleContent>
                </SidebarGroup>
              </Collapsible>
            ))}
          </SidebarContent>
        </SmoothScrollProvider>


        <SidebarFooter className={cn("mt-auto transition-all duration-300", state === 'collapsed' ? "!px-0" : "p-4")}>
          <div className={cn("glass-card rounded-[24px] flex flex-col gap-1 transition-all duration-300", state === 'collapsed' ? "p-0 bg-transparent border-0 shadow-none" : "p-2")}>
            <SidebarMenu>
              <SidebarMenuItem>
                {session ? (
                  <motion.div
                    whileHover={{ scale: 1.03, x: 2 }}
                    whileTap={{ scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                  >
                  <SidebarMenuButton asChild tooltip="Profile" className={cn("rounded-full h-10 transition-all duration-300 btn-press",
                    state === 'collapsed' ? "!justify-center !w-10 !mx-auto !px-0" : "px-2",
                    pathname === '/profile' ? "sidebar-active-item" : "hover:bg-foreground/10"
                  )}>
                    <Link href="/profile" className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 border border-foreground/10">
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
                  </motion.div>
                ) : (
                  <SidebarMenuButton asChild tooltip="Sign In" className={cn("rounded-full h-10 transition-all duration-300 bg-primary/10 text-primary hover:bg-primary/20",
                    state === 'collapsed' ? "!justify-center !w-10 !mx-auto !px-0" : "px-3"
                  )}>
                    <Link href="/auth/signin" className="flex items-center gap-3">
                      <LogIn className="h-4 w-4" />
                      {state === 'expanded' && <span className="text-xs font-bold uppercase tracking-wider">Sign In</span>}
                    </Link>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>
              <SidebarMenuItem>
                <motion.div
                  whileHover={{ scale: 1.03, x: 2 }}
                  whileTap={{ scale: 0.96 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                >
                <SidebarMenuButton
                  onClick={() => {
                    safeViewTransition(() => {
                      setSettingsOpen(true)
                    })
                  }}
                  style={!isSettingsOpen ? { viewTransitionName: 'settings-window' } as React.CSSProperties : undefined}
                  tooltip={t('sidebar.settings')}
                  className={cn("rounded-full h-10 transition-all duration-300 btn-press flex items-center justify-between relative",
                    state === 'collapsed' ? "!justify-center !w-10 !mx-auto !px-0" : "px-3 w-full",
                    isSettingsOpen ? "sidebar-active-item" : "hover:bg-foreground/10"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Settings className="h-4 w-4 icon-hover-spin shrink-0" />
                    {state === 'expanded' && <span className="text-xs">{t('sidebar.settings')}</span>}
                  </div>
                  {state === 'expanded' && (
                    <div className={cn(
                      "flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold border backdrop-blur-md transition-all duration-300",
                      isOnline 
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.15)]"
                        : "bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[0_0_8px_rgba(245,158,11,0.15)]"
                    )}>
                      <span className={cn("w-1 h-1 rounded-full", isOnline ? "bg-emerald-400 animate-pulse" : "bg-amber-400")} />
                      <span>{isOnline ? 'Online' : 'Sin conexión'}</span>
                    </div>
                  )}
                  {state === 'collapsed' && (
                    <div className="absolute top-1.5 right-1.5 flex items-center">
                      <span className={cn("w-2 h-2 rounded-full border border-black/50 shadow-sm", isOnline ? "bg-emerald-400" : "bg-amber-400")} />
                    </div>
                  )}
                </SidebarMenuButton>
                </motion.div>
              </SidebarMenuItem>
            </SidebarMenu>

            {/* ⌘K hint */}
            {state === 'expanded' && (
              <button
                onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))}
                className="mt-2 w-full flex items-center justify-between px-3 py-2 rounded-2xl bg-white/[0.025] hover:bg-white/[0.05] border border-white/[0.06] transition-all group"
              >
                <span className="text-[10px] text-white/30 font-medium group-hover:text-white/50 transition-colors">Búsqueda rápida</span>
                <span className="flex items-center gap-0.5">
                  <kbd className="text-[9px] text-white/25 font-bold bg-white/5 border border-white/10 rounded px-1 py-0.5">⌘</kbd>
                  <kbd className="text-[9px] text-white/25 font-bold bg-white/5 border border-white/10 rounded px-1 py-0.5">K</kbd>
                </span>
              </button>
            )}
          </div>
        </SidebarFooter>
        <SidebarRail />
      </div>
    </Sidebar>
  )
}
