'use client'

import { useState } from 'react'
import { Activity, Zap, Clock, AlertTriangle } from 'lucide-react'
import { LiquidSwitch } from '@/components/ui/liquid-switch'
import { useCognitiveTwin } from '@/lib/cognitive-twin-context'
import { useTranslation } from '@/lib/i18n'
import { ConfidenceGauge, TrustBadge, OrbPrimitive, TelemetryPill } from '@/components/cognitive/primitives'
import { TrustCenter } from '@/components/cognitive/trust-center'
import { Section, Row, OptionButton } from './settings-shared'

export function SettingsTwin() {
  const { twin } = useCognitiveTwin()
  const { language } = useTranslation()

  // Twin behavior state overrides
  const [adaptationMode, setAdaptationMode] = useState<'aggressive' | 'balanced' | 'minimal'>('balanced')
  const [schedulingMode, setSchedulingMode] = useState<'adaptive' | 'fixed' | 'manual'>('adaptive')
  const [simplifyAuto, setSimplifyAuto] = useState(false)
  const [recommendHidden, setRecommendHidden] = useState(true)
  const [autoPrioritize, setAutoPrioritize] = useState(true)

  const role = twin.identity?.role || ''

  const copy = {
    en: { title: 'Cognitive Twin', profile: 'Profile', notInitialized: 'Not initialized', updated: 'Updated', telemetry: 'Operational indicators', note: 'These are operational estimates, not medical or biometric measurements.', load: 'Estimated workload', overload: 'Estimated overload', decision: 'Estimated decision friction', uncalibrated: 'Not calibrated', noData: 'No data', chrono: 'Chronotype', focus: 'Focus style', friction: 'Main friction', notDetected: 'Not detected' },
    es: { title: 'Gemelo cognitivo', profile: 'Perfil', notInitialized: 'Sin inicializar', updated: 'Actualizado', telemetry: 'Indicadores operativos', note: 'Son estimaciones operativas; no son mediciones médicas ni biométricas.', load: 'Carga operativa estimada', overload: 'Sobrecarga estimada', decision: 'Fricción de decisiones estimada', uncalibrated: 'Sin calibrar', noData: 'Sin datos', chrono: 'Cronotipo', focus: 'Estilo de enfoque', friction: 'Fricción principal', notDetected: 'No detectado' },
    fr: { title: 'Jumeau cognitif', profile: 'Profil', notInitialized: 'Non initialisé', updated: 'Mis à jour', telemetry: 'Indicateurs opérationnels', note: 'Ce sont des estimations opérationnelles, pas des mesures médicales ou biométriques.', load: 'Charge opérationnelle estimée', overload: 'Surcharge estimée', decision: 'Friction décisionnelle estimée', uncalibrated: 'Non calibré', noData: 'Aucune donnée', chrono: 'Chronotype', focus: 'Style de concentration', friction: 'Friction principale', notDetected: 'Non détecté' },
    de: { title: 'Kognitiver Zwilling', profile: 'Profil', notInitialized: 'Nicht initialisiert', updated: 'Aktualisiert', telemetry: 'Operative Indikatoren', note: 'Dies sind operative Schätzungen, keine medizinischen oder biometrischen Messwerte.', load: 'Geschätzte Arbeitslast', overload: 'Geschätzte Überlastung', decision: 'Geschätzte Entscheidungsreibung', uncalibrated: 'Nicht kalibriert', noData: 'Keine Daten', chrono: 'Chronotyp', focus: 'Fokusstil', friction: 'Hauptreibung', notDetected: 'Nicht erkannt' },
  }[language]

  const chronoLabel: Record<string, string> = { morning_lark: language === 'es' ? 'Madrugador' : 'Morning lark', night_owl: language === 'es' ? 'Nocturno' : 'Night owl', intermediate: language === 'es' ? 'Pico intermedio' : 'Intermediate peak', '': copy.notDetected }
  const focusLabel: Record<string, string> = { deep_builder: language === 'es' ? 'Trabajo profundo' : 'Deep builder', reactive_communicator: language === 'es' ? 'Comunicación reactiva' : 'Reactive communicator', frantic_juggler: language === 'es' ? 'Multitarea intensa' : 'Frantic juggler', consistent_planner: language === 'es' ? 'Planificación constante' : 'Consistent planner', '': copy.notDetected }
  const frictionLabel: Record<string, string> = { context_switching: language === 'es' ? 'Cambio de contexto' : 'Context switching', procrastination: language === 'es' ? 'Postergación' : 'Procrastination', overcommitment: language === 'es' ? 'Sobrecompromiso' : 'Overcommitment', lack_of_structure: language === 'es' ? 'Falta de estructura' : 'Lack of structure', '': copy.notDetected }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="rounded-3xl border border-foreground/[0.06] bg-foreground/[0.015] p-6 flex flex-col sm:flex-row items-center gap-6">
        <OrbPrimitive size="lg" variant={twin.isInitialized ? 'active' : 'dormant'} />
        <div className="flex-1 text-center sm:text-left">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground/30 mb-1">{copy.title}</p>
          <h2 className="text-xl font-bold text-foreground/90 mb-2">
            {twin.isInitialized ? `${role.charAt(0).toUpperCase() + role.slice(1)} ${copy.profile}` : copy.notInitialized}
          </h2>
          <div className="flex items-center gap-3 justify-center sm:justify-start">
            <TrustBadge level={twin.trustLevel} />
            <span className="text-xs text-foreground/50">{copy.updated} {new Date(twin.updatedAt).toLocaleDateString(language)}</span>
          </div>
        </div>
        <ConfidenceGauge score={twin.confidenceScore} size="md" />
      </div>

      <Section title={copy.telemetry}>
        <p className="-mt-1 text-xs leading-relaxed text-foreground/65">{copy.note}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TelemetryPill
            label={copy.load}
            value={twin.confidenceScore > 0 ? twin.metrics.currentCognitiveLoad : copy.uncalibrated}
            unit={twin.confidenceScore > 0 ? '%' : undefined}
            status={twin.confidenceScore > 0 && twin.metrics.currentCognitiveLoad > 90 ? 'critical' : twin.confidenceScore > 0 && twin.metrics.currentCognitiveLoad > 75 ? 'warning' : 'normal'}
            icon={Activity}
          />
          <TelemetryPill
            label={copy.chrono}
            value={chronoLabel[twin.energyCurve.chronotype] || copy.notDetected}
            icon={Clock}
            status="normal"
          />
          <TelemetryPill
            label={copy.focus}
            value={focusLabel[twin.identity.focusStyle] || copy.notDetected}
            icon={Zap}
            status="normal"
          />
          <TelemetryPill
            label={copy.friction}
            value={frictionLabel[twin.bottlenecks.mainFrictionPoint] || copy.notDetected}
            icon={AlertTriangle}
            status={twin.bottlenecks.mainFrictionPoint ? 'warning' : 'normal'}
          />
        </div>
      </Section>

      <TrustCenter language={language === 'es' ? 'es' : 'en'} />

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
