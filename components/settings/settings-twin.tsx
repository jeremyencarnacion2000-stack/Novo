'use client'

import { useState } from 'react'
import { Activity, Zap, Clock, AlertTriangle, Brain } from 'lucide-react'
import { LiquidSwitch } from '@/components/ui/liquid-switch'
import { useCognitiveTwin } from '@/lib/cognitive-twin-context'
import { ConfidenceGauge, TrustBadge, OrbPrimitive, TelemetryPill } from '@/components/cognitive/primitives'
import { Section, Row, OptionButton } from './settings-shared'

export function SettingsTwin() {
  const { twin } = useCognitiveTwin()

  // Twin behavior state overrides
  const [adaptationMode, setAdaptationMode] = useState<'aggressive' | 'balanced' | 'minimal'>('balanced')
  const [schedulingMode, setSchedulingMode] = useState<'adaptive' | 'fixed' | 'manual'>('adaptive')
  const [simplifyAuto, setSimplifyAuto] = useState(false)
  const [recommendHidden, setRecommendHidden] = useState(true)
  const [autoPrioritize, setAutoPrioritize] = useState(true)

  const role = twin.identity?.role || ''

  // Chronotype / focus labels
  const chronoLabel: Record<string, string> = { morning_lark: 'Morning Lark', night_owl: 'Night Owl', intermediate: 'Intermediate Peak', '': 'Not detected' }
  const focusLabel: Record<string, string> = { deep_builder: 'Deep Builder', reactive_communicator: 'Reactive Communicator', frantic_juggler: 'Frantic Juggler', consistent_planner: 'Consistent Planner', '': 'Not detected' }
  const frictionLabel: Record<string, string> = { context_switching: 'Context Switching', procrastination: 'Procrastination', overcommitment: 'Overcommitment', lack_of_structure: 'Lack of Structure', '': 'Not detected' }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="rounded-3xl border border-foreground/[0.06] bg-foreground/[0.015] p-6 flex flex-col sm:flex-row items-center gap-6">
        <OrbPrimitive size="lg" variant={twin.isInitialized ? 'active' : 'dormant'} />
        <div className="flex-1 text-center sm:text-left">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground/30 mb-1">Cognitive Twin</p>
          <h2 className="text-xl font-bold text-foreground/90 mb-2">
            {twin.isInitialized ? `${role.charAt(0).toUpperCase() + role.slice(1)} Profile` : 'Not Initialized'}
          </h2>
          <div className="flex items-center gap-3 justify-center sm:justify-start">
            <TrustBadge level={twin.trustLevel} />
            <span className="text-xs text-foreground/30">Updated {new Date(twin.updatedAt).toLocaleDateString()}</span>
          </div>
        </div>
        <ConfidenceGauge score={twin.confidenceScore} size="md" />
      </div>

      <Section title="System Telemetry">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TelemetryPill
            label="Cognitive Load"
            value={twin.metrics.currentCognitiveLoad}
            unit="%"
            status={twin.metrics.currentCognitiveLoad > 75 ? 'warning' : twin.metrics.currentCognitiveLoad > 90 ? 'critical' : 'normal'}
            icon={Activity}
          />
          <TelemetryPill
            label="Burnout Risk"
            value={twin.metrics.burnoutIndex}
            unit="%"
            status={twin.metrics.burnoutIndex > 70 ? 'critical' : twin.metrics.burnoutIndex > 50 ? 'warning' : 'good'}
            icon={AlertTriangle}
          />
          <TelemetryPill
            label="Chronotype"
            value={chronoLabel[twin.energyCurve.chronotype] || 'Not detected'}
            icon={Clock}
            status="normal"
          />
          <TelemetryPill
            label="Focus Style"
            value={focusLabel[twin.identity.focusStyle] || 'Not detected'}
            icon={Zap}
            status="normal"
          />
          <TelemetryPill
            label="Main Friction"
            value={frictionLabel[twin.bottlenecks.mainFrictionPoint] || 'Not detected'}
            icon={AlertTriangle}
            status={twin.bottlenecks.mainFrictionPoint ? 'warning' : 'normal'}
          />
          <TelemetryPill
            label="Decision Fatigue"
            value={twin.metrics.decisionFatigueRisk}
            icon={Brain}
            status={twin.metrics.decisionFatigueRisk === 'critical' ? 'critical' : twin.metrics.decisionFatigueRisk === 'high' ? 'warning' : 'normal'}
          />
        </div>
      </Section>

      <Section title="Adaptation Level">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <OptionButton label="Aggressive" description="Twin adapts rapidly to any detected change in your patterns." selected={adaptationMode === 'aggressive'} onClick={() => setAdaptationMode('aggressive')} />
          <OptionButton label="Balanced" description="Gradual adaptation with confirmation before major changes." selected={adaptationMode === 'balanced'} onClick={() => setAdaptationMode('balanced')} />
          <OptionButton label="Minimal" description="Twin observes only. You control all workspace changes." selected={adaptationMode === 'minimal'} onClick={() => setAdaptationMode('minimal')} />
        </div>
      </Section>

      <Section title="Scheduling Strategy">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <OptionButton label="Adaptive Scheduling" description="Twin rearranges your schedule based on energy and load." selected={schedulingMode === 'adaptive'} onClick={() => setSchedulingMode('adaptive')} />
          <OptionButton label="Fixed Time Blocks" description="Hard blocks that cannot be moved automatically." selected={schedulingMode === 'fixed'} onClick={() => setSchedulingMode('fixed')} />
          <OptionButton label="Manual Planning" description="You plan everything. Twin provides suggestions only." selected={schedulingMode === 'manual'} onClick={() => setSchedulingMode('manual')} />
        </div>
      </Section>

      <Section title="Workspace Behavior">
        <div className="rounded-2xl border border-foreground/[0.06] bg-foreground/[0.015] divide-y divide-white/[0.04]">
          <div className="p-4">
            <Row label="Simplify Interface Automatically" description="Twin hides advanced features during high cognitive load.">
              <LiquidSwitch checked={simplifyAuto} onCheckedChange={setSimplifyAuto} />
            </Row>
          </div>
          <div className="p-4">
            <Row label="Recommend Hidden Modules" description="Twin surfaces relevant disabled modules as context shifts.">
              <LiquidSwitch checked={recommendHidden} onCheckedChange={setRecommendHidden} />
            </Row>
          </div>
          <div className="p-4">
            <Row label="Auto Prioritize Tasks" description="Twin reorders your task list based on deadlines and energy.">
              <LiquidSwitch checked={autoPrioritize} onCheckedChange={setAutoPrioritize} />
            </Row>
          </div>
        </div>
      </Section>
    </div>
  )
}
