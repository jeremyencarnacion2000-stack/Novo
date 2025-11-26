"use client"

import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { DashboardShell } from "@/components/dashboard-shell"

export default function ProfilePage() {
  const { data: session } = useSession()

  if (!session) {
    return (
      <DashboardShell>
        <div>Please sign in to view your profile.</div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell>
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Manage your account settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={session.user.image || ''} />
                <AvatarFallback className="text-lg">
                  {session.user.name?.charAt(0) || session.user.email?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-xl font-semibold">{session.user.name || 'User'}</h3>
                <p className="text-muted-foreground">{session.user.email}</p>
                <Badge variant="secondary" className="mt-2">
                  {session.user.role === 'admin' ? 'Administrator' : 'Regular User'}
                </Badge>
              </div>
            </div>

            <div className="grid gap-4">
              <div>
                <label className="text-sm font-medium">Email</label>
                <p className="text-sm text-muted-foreground">{session.user.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Role</label>
                <p className="text-sm text-muted-foreground">
                  {session.user.role === 'admin' ? 'Administrator' : 'Regular User'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">User ID</label>
                <p className="text-sm text-muted-foreground font-mono">{session.user.id}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  )
}