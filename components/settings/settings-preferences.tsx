'use client'

import { useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { LiquidSwitch } from '@/components/ui/liquid-switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { Lock } from 'lucide-react'
import { useSettings } from '@/lib/settings-context'
import { useSession } from 'next-auth/react'
import { useNotifications } from '@/lib/notification-context'
import { useTranslation } from '@/lib/i18n'
import { DataIntegrator } from '@/lib/data-integrator'
import { Section, Row } from './settings-shared'

export function SettingsPreferences() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const { settings, updateSettings } = useSettings()
  const { isSupported, permission, requestPermission, settings: notificationSettings, updateSettings: updateNotificationSettings } = useNotifications()
  const { data: session } = useSession()

  const handleRequestPermission = async () => {
    const result = await requestPermission()
    if (result === 'granted') {
      toast({
        title: 'Notifications enabled',
        description: 'You will now receive push notifications.',
      })
    } else {
      toast({
        title: 'Notifications denied',
        description: 'Push notifications are disabled. Please check your browser settings.',
        variant: 'destructive',
      })
    }
  }

  // Handle auto-backup toggle
  useEffect(() => {
    if (settings.autoBackup && session?.user?.id) {
      DataIntegrator.scheduleAutoBackup(session.user.id, settings.backupFrequency)
    } else {
      const existingTimer = localStorage.getItem('novo-auto-backup-timer')
      if (existingTimer) {
        clearInterval(parseInt(existingTimer))
        localStorage.removeItem('novo-auto-backup-timer')
      }
    }
  }, [settings.autoBackup, settings.backupFrequency, session?.user?.id])

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* User Profile */}
      <Section title={t('settings.profile.title')}>
        <div className="rounded-2xl border border-foreground/[0.06] bg-foreground/[0.015] p-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">{t('settings.display_name')}</Label>
            <Input
              id="displayName"
              value={settings.displayName}
              onChange={(e) => updateSettings({ displayName: e.target.value })}
              placeholder="Enter name"
              className="bg-foreground/5 border-foreground/10 text-foreground"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t('settings.email')}</Label>
            <Input
              id="email"
              type="email"
              value={settings.email}
              onChange={(e) => updateSettings({ email: e.target.value })}
              placeholder="Enter email"
              className="bg-foreground/5 border-foreground/10 text-foreground"
            />
          </div>

          <Separator className="bg-foreground/[0.05]" />

          <div className="space-y-2">
            <Label>{t('settings.password')}</Label>
            <Button variant="outline" className="w-full border-foreground/10 hover:bg-foreground/5">
              <Lock className="mr-2 h-4 w-4" />
              {t('settings.change_password')}
            </Button>
          </div>
        </div>
      </Section>

      {/* Regional Formats */}
      <Section title={t('settings.general.title')}>
        <div className="rounded-2xl border border-foreground/[0.06] bg-foreground/[0.015] p-5 space-y-4">
          <Row label={t('settings.language.label')} description={t('settings.language.desc')}>
            <Select value={settings.language} onValueChange={(value: any) => updateSettings({ language: value })}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Espanol</SelectItem>
                <SelectItem value="fr">Francais</SelectItem>
                <SelectItem value="de">Deutsch</SelectItem>
              </SelectContent>
            </Select>
          </Row>

          <Separator className="bg-foreground/[0.05]" />

          <Row label={t('settings.start_week.label')} description={t('settings.start_week.desc')}>
            <Select value={settings.startOfWeek} onValueChange={(value: any) => updateSettings({ startOfWeek: value })}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sunday">Sunday</SelectItem>
                <SelectItem value="monday">Monday</SelectItem>
                <SelectItem value="saturday">Saturday</SelectItem>
              </SelectContent>
            </Select>
          </Row>

          <Separator className="bg-foreground/[0.05]" />

          <Row label={t('settings.date_format.label')} description={t('settings.date_format.desc')}>
            <Select value={settings.dateFormat} onValueChange={(value: any) => updateSettings({ dateFormat: value })}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
              </SelectContent>
            </Select>
          </Row>

          <Separator className="bg-foreground/[0.05]" />

          <Row label={t('settings.time_format.label')} description={t('settings.time_format.desc')}>
            <Select value={settings.timeFormat} onValueChange={(value: any) => updateSettings({ timeFormat: value })}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12h">12-hour</SelectItem>
                <SelectItem value="24h">24-hour</SelectItem>
              </SelectContent>
            </Select>
          </Row>
        </div>
      </Section>

      {/* Desktop Push Notifications */}
      <Section title={t('settings.notifications.title')}>
        <div className="rounded-2xl border border-foreground/[0.06] bg-foreground/[0.015] p-5 space-y-4">
          <Row label={t('settings.daily_reminder.label')} description={t('settings.daily_reminder.desc')}>
            <LiquidSwitch checked={settings.dailyReminder} onCheckedChange={(checked) => updateSettings({ dailyReminder: checked })} />
          </Row>

          <Row label={t('settings.reminder_time.label')} description={t('settings.reminder_time.desc')}>
            <Input
              type="time"
              value={settings.reminderTime}
              onChange={(e) => updateSettings({ reminderTime: e.target.value })}
              className="w-[180px] bg-foreground/5 border-foreground/10"
            />
          </Row>

          <Separator className="bg-foreground/[0.05]" />

          <Row label={t('settings.routine_notif.label')} description={t('settings.routine_notif.desc')}>
            <LiquidSwitch checked={settings.routineNotifications} onCheckedChange={(checked) => updateSettings({ routineNotifications: checked })} />
          </Row>

          <Row label={t('settings.project_deadlines.label')} description={t('settings.project_deadlines.desc')}>
            <LiquidSwitch checked={settings.projectDeadlines} onCheckedChange={(checked) => updateSettings({ projectDeadlines: checked })} />
          </Row>

          <Separator className="bg-foreground/[0.05]" />

          {isSupported ? (
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground/85">Push Notifications Status</p>
                  <p className="text-xs text-foreground/35">
                    Status: <span className="capitalize">{permission}</span>
                  </p>
                </div>
                {permission !== 'granted' && (
                  <Button variant="outline" size="sm" onClick={handleRequestPermission} className="border-foreground/10 hover:bg-foreground/5">
                    Enable Notifications
                  </Button>
                )}
              </div>

              <Separator className="bg-foreground/[0.05]" />

              <Row label="Habit Reminders" description="Push updates to log daily habit progress.">
                <LiquidSwitch
                  checked={notificationSettings.habitReminders}
                  onCheckedChange={(checked) => updateNotificationSettings({ habitReminders: checked })}
                  disabled={permission !== 'granted'}
                />
              </Row>

              <Row label="Task Notifications" description="Updates when tasks are priority reordered.">
                <LiquidSwitch
                  checked={notificationSettings.taskNotifications}
                  onCheckedChange={(checked) => updateNotificationSettings({ taskNotifications: checked })}
                  disabled={permission !== 'granted'}
                />
              </Row>

              <Row label="Celebrate Milestones" description="Receive congratulations for completed focus blocks.">
                <LiquidSwitch
                  checked={notificationSettings.progressAchievements}
                  onCheckedChange={(checked) => updateNotificationSettings({ progressAchievements: checked })}
                  disabled={permission !== 'granted'}
                />
              </Row>

              <Row label="Sound Effects" description="Play micro-tones with desktop notifications.">
                <LiquidSwitch
                  checked={notificationSettings.soundEnabled}
                  onCheckedChange={(checked) => updateNotificationSettings({ soundEnabled: checked })}
                  disabled={permission !== 'granted'}
                />
              </Row>
            </div>
          ) : (
            <p className="text-xs text-foreground/30">Desktop push notifications are not supported in this browser.</p>
          )}
        </div>
      </Section>

      {/* Auto Backup */}
      <Section title="Automatic Backup">
        <div className="rounded-2xl border border-foreground/[0.06] bg-foreground/[0.015] p-5 space-y-4">
          <Row label="Auto Backup" description="Automatically back up your workspace data on a recurring schedule.">
            <LiquidSwitch
              checked={settings.autoBackup}
              onCheckedChange={(checked) => updateSettings({ autoBackup: checked })}
            />
          </Row>
          {settings.autoBackup && (
            <>
              <Separator className="bg-foreground/[0.05]" />
              <Row label="Backup Frequency" description="How often Novo creates an automatic snapshot of your workspace.">
                <Select
                  value={settings.backupFrequency}
                  onValueChange={(value: any) => updateSettings({ backupFrequency: value })}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
            </>
          )}
          <p className="text-[10px] text-foreground/25 leading-relaxed pt-1">
            Backups are stored locally and can be restored from the Advanced tab. Connect Google Drive for cloud redundancy.
          </p>
        </div>
      </Section>
    </div>
  )
}
