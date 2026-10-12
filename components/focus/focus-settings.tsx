'use client'

import { memo, useRef, useState } from 'react'
import { useFocusControls, type TimerProfile } from '@/lib/focus-context'
import { createClientIdempotencyKey } from '@/lib/client-idempotency'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Settings, Plus, Trash2, Volume2, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

function boundedMinutes(value: number | undefined, fallback: number, max: number) {
    return Number.isFinite(value) ? Math.min(max, Math.max(1, Math.round(value as number))) : fallback
}

export const FocusSettings = memo(function FocusSettings() {
    const [open, setOpen] = useState(false)
    const addProfileLockRef = useRef(false)
    const [isAddingProfile, setIsAddingProfile] = useState(false)
    const handleOpenChange = (o: boolean) => {
        setOpen(o)
    }

    const {
        profiles,
        activeProfileId,
        setActiveProfileId,
        addProfile,
        deleteProfile,
        soundSettings,
        setSoundSettings
    } = useFocusControls()

    const [newProfile, setNewProfile] = useState<Partial<TimerProfile>>({
        name: '',
        workDuration: 25,
        shortBreakDuration: 5,
        longBreakDuration: 15,
        pomodorosUntilLongBreak: 4,
        autoStartBreaks: false,
        autoStartWork: false
    })

    const handleAddProfile = () => {
        const name = newProfile.name?.trim()
        // The profile list is persisted locally, so a double pointer event
        // would otherwise create two permanent copies before the next render
        // can disable the button. Keep a synchronous lock for that gap.
        if (!name || addProfileLockRef.current) return
        addProfileLockRef.current = true
        setIsAddingProfile(true)

        addProfile({
            id: createClientIdempotencyKey(),
            name,
            workDuration: boundedMinutes(newProfile.workDuration, 25, 240),
            shortBreakDuration: boundedMinutes(newProfile.shortBreakDuration, 5, 120),
            longBreakDuration: boundedMinutes(newProfile.longBreakDuration, 15, 240),
            pomodorosUntilLongBreak: boundedMinutes(newProfile.pomodorosUntilLongBreak, 4, 12),
            autoStartBreaks: newProfile.autoStartBreaks || false,
            autoStartWork: newProfile.autoStartWork || false
        })

        setNewProfile({
            name: '',
            workDuration: 25,
            shortBreakDuration: 5,
            longBreakDuration: 15,
            pomodorosUntilLongBreak: 4,
            autoStartBreaks: false,
            autoStartWork: false
        })
        addProfileLockRef.current = false
        setIsAddingProfile(false)
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline" size="icon" data-flip-from="btn-focus-settings">
                    <Settings data-shared-item="icon" className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent motionId="btn-focus-settings" className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Settings data-shared-item="icon" className="h-5 w-5" />
                        Focus Settings
                    </DialogTitle>
                    <DialogDescription>Configure your timer profiles and sound settings</DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="profiles" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="profiles">Timer Profiles</TabsTrigger>
                        <TabsTrigger value="sound">Sound & Notifications</TabsTrigger>
                    </TabsList>

                    <TabsContent value="profiles" className="space-y-4 mt-4">
                        <div className="grid gap-4">
                            <Label>Active Profile</Label>
                            <Select value={activeProfileId} onValueChange={setActiveProfileId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a profile" />
                                </SelectTrigger>
                                <SelectContent>
                                    {profiles.map(profile => (
                                        <SelectItem key={profile.id} value={profile.id}>
                                            {profile.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-4 rounded-[20px] bg-foreground/[0.03] border border-foreground/[0.04] p-4">
                            <h4 className="font-medium flex items-center gap-2">
                                <Plus className="h-4 w-4" /> Create New Profile
                            </h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Name</Label>
                                    <Input
                                        value={newProfile.name}
                                        onChange={e => setNewProfile({ ...newProfile, name: e.target.value })}
                                        placeholder="e.g. Power Hour"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Work (min)</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={240}
                                        value={newProfile.workDuration}
                                        onChange={e => setNewProfile({ ...newProfile, workDuration: parseInt(e.target.value) })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Short Break (min)</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={120}
                                        value={newProfile.shortBreakDuration}
                                        onChange={e => setNewProfile({ ...newProfile, shortBreakDuration: parseInt(e.target.value) })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Long Break (min)</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={240}
                                        value={newProfile.longBreakDuration}
                                        onChange={e => setNewProfile({ ...newProfile, longBreakDuration: parseInt(e.target.value) })}
                                    />
                                </div>
                            </div>
                            <Button onClick={handleAddProfile} disabled={isAddingProfile || !newProfile.name?.trim()} className="w-full">{isAddingProfile ? 'Adding…' : 'Add Profile'}</Button>
                        </div>

                        <div className="space-y-2">
                            <Label>Manage Profiles</Label>
                            <div className="grid gap-2">
                                {profiles.map(profile => (
                                    <Card key={profile.id}>
                                        <CardContent className="flex items-center justify-between p-3">
                                            <div className="flex items-center gap-2">
                                                <Clock className="h-4 w-4 text-muted-foreground" />
                                                <div>
                                                    <p className="font-medium text-sm">{profile.name}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {profile.workDuration}/{profile.shortBreakDuration}/{profile.longBreakDuration}
                                                    </p>
                                                </div>
                                            </div>
                                            {profiles.length > 1 && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => deleteProfile(profile.id)}
                                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="sound" className="space-y-6 mt-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Enable Sound</Label>
                                <p className="text-sm text-muted-foreground">Play sound when timer ends</p>
                            </div>
                            <Switch
                                checked={soundSettings.enabled}
                                onCheckedChange={checked => setSoundSettings({ ...soundSettings, enabled: checked })}
                            />
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label>Volume</Label>
                                <span className="text-sm text-muted-foreground">{Math.round(soundSettings.volume * 100)}%</span>
                            </div>
                            <Slider
                                value={[soundSettings.volume]}
                                max={1}
                                step={0.1}
                                onValueChange={([val]) => setSoundSettings({ ...soundSettings, volume: val })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Alarm Sound</Label>
                            <Select
                                value={soundSettings.soundId}
                                onValueChange={val => setSoundSettings({ ...soundSettings, soundId: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="bell">Classic Bell</SelectItem>
                                    <SelectItem value="digital">Digital Beep</SelectItem>
                                    <SelectItem value="chime">Soft Chime</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    )
})
