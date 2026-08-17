'use client'

import { Bell, Calendar, CheckSquare, Mail, MessageSquare, AlertTriangle, FileText } from 'lucide-react'
import { motion } from 'framer-motion'

// Shared decorative visual for /auth/signin and /auth/signup left panels —
// icons drifting along a figure-8 path around a crystal core, echoing the
// "Information isn't the problem" reference image.
const ORBIT_ICONS = [Bell, Calendar, CheckSquare, Mail, MessageSquare, AlertTriangle, FileText]

export function InfinityOrbit() {
  return (
    <div className="relative w-[340px] h-[170px] flex items-center justify-center">
      {/* Crystal core */}
      <motion.div
        className="absolute h-14 w-14"
        animate={{ rotate: 360 }}
        transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
      >
        <div className="absolute inset-0 rotate-45 rounded-md bg-gradient-to-br from-emerald-300/80 via-white/60 to-teal-400/80 blur-[1px] shadow-[0_0_40px_rgba(74,222,128,0.5)]" />
        <div className="absolute inset-2 rotate-12 rounded-sm bg-gradient-to-tr from-white/70 to-emerald-200/50" />
      </motion.div>
      <div className="absolute h-20 w-20 rounded-full bg-emerald-400/20 blur-2xl" />

      {/* Orbiting icon chips along a figure-8 path */}
      {ORBIT_ICONS.map((Icon, i) => {
        const t = i / ORBIT_ICONS.length
        return (
          <motion.div
            key={i}
            className="absolute h-7 w-7 rounded-lg bg-white/10 border border-white/15 backdrop-blur-md flex items-center justify-center shadow-lg"
            style={{ offsetPath: "path('M 0 0 C -85 -70, -170 70, -170 0 C -170 -70, -85 70, 0 0 C 85 -70, 170 70, 170 0 C 170 -70, 85 70, 0 0 Z')" } as any}
            animate={{ offsetDistance: ['0%', '100%'] } as any}
            initial={{ offsetDistance: `${t * 100}%` } as any}
            transition={{ duration: 24, repeat: Infinity, ease: 'linear', delay: -t * 24 }}
          >
            <Icon className="h-3.5 w-3.5 text-white/60" />
          </motion.div>
        )
      })}
    </div>
  )
}
