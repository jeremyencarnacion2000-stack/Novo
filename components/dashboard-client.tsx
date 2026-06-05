'use client'

import { DashboardMetrics } from '@/components/dashboard-metrics'
import { QuickActions } from '@/components/quick-actions'
import { RecentActivity } from '@/components/recent-activity'
import { DashboardHabits } from '@/components/dashboard-habits'
import { useSettings } from '@/lib/settings-context'
import { Card } from '@/components/ui/card'
import React, { useEffect, useState } from 'react'
import { DashboardQuickView } from './dashboard/dashboard-quick-view'
import { motion } from 'framer-motion'
import { CognitiveEngineWidget } from '@/components/cognitive/cognitive-engine-widget'
import { VoiceCommandButton } from '@/components/cognitive/voice-command-button'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, scale: 0.96, y: 15 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 100,
      damping: 15,
      mass: 0.8
    }
  }
}

export default function DashboardClient() {
  const { settings } = useSettings()
  const [greeting, setGreeting] = useState('Welcome back')
  const [refreshKey, setRefreshKey] = useState(0)

  // Quick View State
  const [quickViewOpen, setQuickViewOpen] = useState(false)
  const [quickViewType, setQuickViewType] = useState<'routine' | 'project' | 'task' | null>(null)
  const [quickViewData, setQuickViewData] = useState<any>(null)

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) {
      setGreeting('Good morning')
    } else if (hour < 18) {
      setGreeting('Good afternoon')
    } else {
      setGreeting('Good evening')
    }
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey((prev: number) => prev + 1)
    }, 30000)
    return () => clearInterval(interval)
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
      <div className="hidden md:flex flex-col gap-12">
        <motion.div variants={itemVariants} className="flex justify-between items-center w-full">
          <div className="space-y-2">
            <h1 className="text-4xl md:text-7xl font-light tracking-tight italic opacity-90">
              {greeting}
            </h1>
            <p className="subtitle-technical">
              System status · live pulse · encrypted
            </p>
          </div>
          <VoiceCommandButton />
        </motion.div>

        <motion.div variants={itemVariants}>
          <DashboardMetrics refreshKey={refreshKey} />
        </motion.div>

        <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
          <div className="lg:col-span-2 grid gap-6 md:grid-cols-2">
            <motion.div variants={itemVariants} className="space-y-6">
              <Card variant="secondary" className="p-0 border-none shadow-none">
                <QuickActions />
              </Card>
              <DashboardHabits />
            </motion.div>
            <motion.div variants={itemVariants}>
              <Card variant="tertiary" className="p-0 border-none shadow-none h-full">
                <RecentActivity onActivityClick={handleActivityClick} />
              </Card>
            </motion.div>
          </div>
          <motion.div variants={itemVariants} className="space-y-6">
            <CognitiveEngineWidget />
          </motion.div>
        </div>
      </div>

      {/* --- MOBILE VIEW --- */}
      <div className="md:hidden flex flex-col gap-8 pb-24">
        {/* Greeting & Voice Command */}
        <motion.div variants={itemVariants} className="flex justify-between items-center w-full px-1">
          <div className="space-y-1">
            <h1 className="text-4xl font-light tracking-tight italic opacity-90">
              {greeting}
            </h1>
            <p className="subtitle-technical text-[8px]">
              System status · live pulse
            </p>
          </div>
          <VoiceCommandButton />
        </motion.div>

        {/* Cognitive Engine Widget */}
        <motion.div variants={itemVariants}>
          <CognitiveEngineWidget />
        </motion.div>

        {/* Metrics (2-column grid, same real data as desktop) */}
        <motion.div variants={itemVariants}>
          <DashboardMetrics refreshKey={refreshKey} />
        </motion.div>

        {/* Recent Activity (full width) */}
        <motion.div variants={itemVariants}>
          <RecentActivity onActivityClick={handleActivityClick} />
        </motion.div>

        {/* Quick Actions */}
        <motion.div variants={itemVariants}>
          <QuickActions />
        </motion.div>
      </div>

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