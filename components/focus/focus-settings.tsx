'use client'

import React, { useState } from 'react'
import { useFocus, TimerProfile } from '@/lib/focus-context'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Settings, Plus, Trash2, Volume2, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export function FocusSettings() {
    const {
        profiles,
        activeProfileId,
        setActiveProfileId,
        addProfile,
        deleteProfile,
        soundSettings,
        setSoundSettings
    } = useFocus()

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
        if (!newProfile.name) return

        addProfile({
            id: Math.random().toString(36).substr(2, 9),
            name: newProfile.name,
            workDuration: newProfile.workDuration || 25,
            shortBreakDuration: newProfile.shortBreakDuration || 5,
            longBreakDuration: newProfile.longBreakDuration || 15,
            pomodorosUntilLongBreak: newProfile.pomodorosUntilLongBreak || 4,
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
    }

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="icon">
                    <Settings className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Focus Settings</DialogTitle>
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

                        <div className="space-y-4 border rounded-lg p-4">
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
                                        value={newProfile.workDuration}
                                        onChange={e => setNewProfile({ ...newProfile, workDuration: parseInt(e.target.value) })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Short Break (min)</Label>
                                    <Input
                                        type="number"
                                        value={newProfile.shortBreakDuration}
                                        onChange={e => setNewProfile({ ...newProfile, shortBreakDuration: parseInt(e.target.value) })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Long Break (min)</Label>
                                    <Input
                                        type="number"
                                        value={newProfile.longBreakDuration}
                                        onChange={e => setNewProfile({ ...newProfile, longBreakDuration: parseInt(e.target.value) })}
                                    />
                                </div>
                            </div>
                            <Button onClick={handleAddProfile} className="w-full">Add Profile</Button>
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
}
