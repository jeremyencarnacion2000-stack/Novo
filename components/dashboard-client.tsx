'use client'

import { DashboardMetrics } from '@/components/dashboard-metrics'
import { QuickActions } from '@/components/quick-actions'
import { RecentActivity } from '@/components/recent-activity'
import { DashboardHabits } from '@/components/dashboard-habits'
import { useSettings } from '@/lib/settings-context'
import { useTranslation } from '@/lib/i18n'
import { Card } from '@/components/ui/card'
import React, { useEffect, useState, useCallback } from 'react'
import { DashboardQuickView } from './dashboard/dashboard-quick-view'
import { motion, type Variants } from 'framer-motion'
import { CognitiveEngineWidget } from '@/components/cognitive/cognitive-engine-widget'
import { NowHero } from '@/components/dashboard/now-hero'
import { springConfig } from '@/lib/design-tokens'
import { ScrollReveal } from '@/components/ui/scroll-reveal'
import { useCognitivePhase } from '@/lib/cognitive-context'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { Shield } from 'lucide-react'

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
    }
  }
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 30 },
  }
}

export default function DashboardClient() {
  const { settings } = useSettings()
  const { t } = useTranslation()
  const [refreshKey, setRefreshKey] = useState(0)
  const phase = useCognitivePhase()
  const isMobile = useIsMobile()

  // Reactive greeting — re-computed each render, uses i18n system
  const getGreeting = useCallback(() => {
    const hour = new Date().getHours()
    if (hour < 12) return t('greeting.morning')
    if (hour < 18) return t('greeting.afternoon')
    return t('greeting.evening')
  }, [t])

  // Quick View State
  const [quickViewOpen, setQuickViewOpen] = useState(false)
  const [quickViewType, setQuickViewType] = useState<'routine' | 'project' | 'task' | null>(null)
  const [quickViewData, setQuickViewData] = useState<any>(null)

  // Refresh metrics when user returns to the tab (vs. aggressive 2-min polling)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setRefreshKey(prev => prev + 1)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  const handleActivityClick = (type: 'routine' | 'project' | 'task', data: any) => {
    setQuickViewType(type)
    setQuickViewData(data)
    setQuickViewOpen(true)
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* --- DESKTOP VIEW --- */}
      {!isMobile && (
      <div className="flex flex-col gap-8">
        <motion.div variants={itemVariants}>
          <NowHero />
        </motion.div>

        <motion.div variants={itemVariants} className="flex justify-between items-center w-full">
          <div className="space-y-1.5">
            <h2 className="text-xl md:text-2xl font-light tracking-tight italic opacity-70 flex items-center gap-3 flex-wrap">
              {getGreeting()}
              {phase !== 'LINEAR_EXECUTION' && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={cn(
                    "text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border leading-none shadow-sm transition-all duration-500",
                    phase === 'PEAK_FOCUS' && "bg-indigo-500/10 text-indigo-400 border-indigo-500/20 shadow-indigo-500/5",
                    phase === 'SYNAPTIC_FATIGUE' && "bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-amber-500/5",
                    phase === 'REDUCED_CAPACITY_MODE' && "bg-red-500/10 text-red-400 border-red-500/20 shadow-red-500/5"
                  )}
                <motion.span
                  className={cn(
                    "text-[9px] font-mono font-bold uppercase tracking-[0.14em] px-2.5 py-1 rounded-full border shadow-sm inline-flex items-center gap-1.5",
                    phase === 'PEAK_FOCUS' && "bg-indigo-500/10 text-indigo-400 border-indigo-500/20 shadow-indigo-500/5",
                    phase === 'SYNAPTIC_FATIGUE' && "bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-amber-500/5",
                    phase === 'REDUCED_CAPACITY_MODE' && "bg-red-500/10 text-red-400 border-red-500/20 shadow-red-500/5"
                  )}
                >
                  <Shield className="w-3 h-3" />
                  <span>Adaptive Shield: {phase === 'PEAK_FOCUS' ? 'Peak Focus' : phase === 'SYNAPTIC_FATIGUE' ? 'Recovery Mode' : 'Stress Adapt'}</span>
                </motion.span>
              )}
            </h2>
            <p className="subtitle-technical">
              System status · live pulse · encrypted
            </p>
          </div>
        </motion.div>

        <motion.div variants={itemVariants}>
          <DashboardMetrics refreshKey={refreshKey} compact />
        </motion.div>

        <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
          <div className="lg:col-span-2 grid gap-6 md:grid-cols-2">
            <ScrollReveal delay={0} className="space-y-6 cognitive-secondary-element">
              <Card variant="liquid" className="p-0">
                <QuickActions />
              </Card>
              <DashboardHabits />
            </ScrollReveal>
            <ScrollReveal delay={0.06} className="cognitive-secondary-element">
              <Card variant="liquid" className="p-0 h-full">
                <RecentActivity onActivityClick={handleActivityClick} />
              </Card>
            </ScrollReveal>
          </div>
          <ScrollReveal delay={0.12} className="space-y-6">
            <CognitiveEngineWidget />
          </ScrollReveal>
        </div>
      </div>
      )}

      {/* --- MOBILE VIEW --- */}
      {isMobile && (
      <div className="flex flex-col gap-8 pb-24">
        {/* Ahora → — the one decision, leads the page */}
        <motion.div variants={itemVariants} className="px-1">
          <NowHero />
        </motion.div>

        {/* Greeting */}
        <motion.div variants={itemVariants} className="flex justify-between items-center w-full px-1">
          <div className="space-y-1">
            <h2 className="text-lg font-light tracking-tight italic opacity-70 flex items-center gap-2 flex-wrap">
              {getGreeting()}
              {phase !== 'LINEAR_EXECUTION' && (
                <span
                  className={cn(
                    "text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded-full border leading-none inline-flex items-center gap-1",
                    phase === 'PEAK_FOCUS' && "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
                    phase === 'SYNAPTIC_FATIGUE' && "bg-amber-500/10 text-amber-400 border-amber-500/20",
                    phase === 'REDUCED_CAPACITY_MODE' && "bg-red-500/10 text-red-400 border-red-500/20"
                  )}
                >
                  <Shield className="w-2.5 h-2.5" />
                  <span>Shield Active</span>
                </span>
              )}
            </h2>
            <p className="subtitle-technical text-[8px]">
              System status · live pulse
            </p>
          </div>
        </motion.div>

        {/* Metrics (slim strip, same real data as desktop) */}
        <motion.div variants={itemVariants} className="cognitive-secondary-element px-1">
          <DashboardMetrics refreshKey={refreshKey} compact />
        </motion.div>

        {/* Recent Activity (full width) */}
        <motion.div variants={itemVariants} className="cognitive-secondary-element">
          <RecentActivity onActivityClick={handleActivityClick} />
        </motion.div>

        {/* Quick Actions */}
        <motion.div variants={itemVariants} className="cognitive-secondary-element">
          <QuickActions />
        </motion.div>

        {/* Cognitive Engine Widget — demoted, detail view lives at /cognitive */}
        <motion.div variants={itemVariants}>
          <CognitiveEngineWidget />
        </motion.div>
      </div>
      )}

      {/* Quick View Side Panel */}
      <DashboardQuickView
        open={quickViewOpen}
        onClose={() => setQuickViewOpen(false)}
        type={quickViewType}
        data={quickViewData}
      />
    </motion.div>
  )
}