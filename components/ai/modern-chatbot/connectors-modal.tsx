'use client'

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plug, Check, RefreshCw, Sparkles, Link2 } from 'lucide-react'
import { signIn } from 'next-auth/react'
import { useToast } from '@/hooks/use-toast'
import { useDragToDismiss } from '@/hooks/use-drag-to-dismiss'
import {
  SiNotion, SiGoogledrive, SiGmail,
  SiGooglecalendar, SiTodoist
} from 'react-icons/si'
import { FaSlack } from 'react-icons/fa6'
import type { IconType } from 'react-icons'

interface ConnectorsModalProps {
  isOpen: boolean
  onClose: () => void
}

interface ConnectorItem {
  id: string
  name: string
  category: string
  description: string
  icon: IconType
  brandColor: string
  connected: boolean
  connectUrl?: string
  oauthProvider?: string
}

export function ConnectorsModal({ isOpen, onClose }: ConnectorsModalProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [statuses, setStatuses] = useState<Record<string, boolean>>({})
  const dragSurfaceRef = useDragToDismiss<HTMLDivElement>({
    onDismiss: onClose,
    enabled: isOpen,
  })

  const fetchStatuses = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/integration/status')
      if (res.ok) {
        const data = await res.json()
        setStatuses({
          notion: !!data.notion?.connected,
          todoist: !!data.todoist?.connected,
          slack: !!data.slack?.connected,
          google: !!data.google?.connected,
          gmail: !!data.gmail?.connected,
          calendar: !!data.calendar?.connected || !!data.google?.connected,
          drive: !!data.drive?.connected || !!data.google?.connected,
        })
      }
    } catch (err) {
      console.error('Failed to load connector status:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchStatuses()
    }
  }, [isOpen])

  const connectors: ConnectorItem[] = [
    {
      id: 'notion',
      name: 'Notion',
      category: 'Productividad',
      description: 'Sincroniza bases de datos, notas y proyectos de Notion con la IA.',
      icon: SiNotion,
      brandColor: '#ffffff',
      connected: !!statuses.notion,
      connectUrl: '/api/integration/notion/connect',
    },
    {
      id: 'todoist',
      name: 'Todoist',
      category: 'Tareas',
      description: 'Permite que la IA lea y complete tus tareas organizadas en Todoist.',
      icon: SiTodoist,
      brandColor: '#E4405F',
      connected: !!statuses.todoist,
      connectUrl: '/api/integration/todoist/connect',
    },
    {
      id: 'googlecalendar',
      name: 'Google Calendar',
      category: 'Calendario',
      description: 'Acceso a eventos, bloques de tiempo y agendamiento inteligente.',
      icon: SiGooglecalendar,
      brandColor: '#4285F4',
      connected: !!statuses.calendar || !!statuses.google,
      oauthProvider: 'google',
    },
    {
      id: 'gmail',
      name: 'Gmail',
      category: 'Correo',
      description: 'El chatbot puede resumir y detectar tareas urgentes en tu bandeja.',
      icon: SiGmail,
      brandColor: '#EA4335',
      connected: !!statuses.gmail || !!statuses.google,
      oauthProvider: 'google',
    },
    {
      id: 'slack',
      name: 'Slack',
      category: 'Comunicación',
      description: 'Captura mensajes clave y recordatorios desde tus canales de Slack.',
      icon: FaSlack,
      brandColor: '#ECB22E',
      connected: !!statuses.slack,
      connectUrl: '/api/integration/slack/connect',
    },
    {
      id: 'googledrive',
      name: 'Google Drive',
      category: 'Documentos',
      description: 'La IA puede consultar tus documentos y archivos guardados en Drive.',
      icon: SiGoogledrive,
      brandColor: '#FFBA00',
      connected: !!statuses.drive || !!statuses.google,
      oauthProvider: 'google',
    },
  ]

  const handleConnect = (connector: ConnectorItem) => {
    if (connector.connectUrl) {
      window.location.href = connector.connectUrl
    } else if (connector.oauthProvider) {
      signIn(connector.oauthProvider)
    } else {
      toast({
        title: 'Próximamente',
        description: `La integración con ${connector.name} estará disponible pronto.`,
      })
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          data-modal-drag-overlay
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-foreground/55 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          ref={dragSurfaceRef}
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          className="relative z-10 w-full max-w-lg max-h-[85vh] flex flex-col rounded-[32px] border border-border bg-popover/95 shadow-[0_24px_80px_rgba(0,0,0,0.28)] overflow-hidden"
        >
          <div aria-hidden="true" className="sm:hidden flex justify-center pt-3 pb-1 pointer-events-none">
            <div className="h-[4px] w-10 rounded-full bg-foreground/20" />
          </div>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-border/70 bg-muted/45">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)]">
                <Plug className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground tracking-tight">Conectores & Plugins de IA</h3>
                <p className="text-xs text-muted-foreground">Activa integraciones para que la IA las use como herramientas</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 custom-scrollbar">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                <span className="text-xs font-medium">Verificando estado de plugins...</span>
              </div>
            ) : (
              connectors.map((connector) => {
                const Icon = connector.icon
                return (
                  <div
                    key={connector.id}
                    className="flex items-start gap-4 p-4 rounded-2xl border border-border/70 bg-muted/45 hover:border-border transition-colors duration-200"
                  >
                    <div className="shrink-0 w-10 h-10 rounded-xl bg-background/60 border border-border/70 flex items-center justify-center mt-0.5">
                      <Icon className="w-5 h-5" style={{ color: connector.brandColor }} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-foreground">{connector.name}</h4>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-background/60 text-muted-foreground border border-border/70">
                          {connector.category}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{connector.description}</p>
                    </div>

                    <div className="shrink-0">
                      {connector.connected ? (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
                          <Check className="w-3.5 h-3.5" />
                          <span>Plugin Activo</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleConnect(connector)}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 text-xs font-bold transition-all active:scale-95"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                          <span>Conectar</span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer note */}
          <div className="px-6 py-4 border-t border-border/70 bg-muted/45 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Los plugins activos amplían las capacidades cognitivas del chatbot.</span>
            </div>
            <button
              onClick={fetchStatuses}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Actualizar estado"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
