"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { DashboardShell } from "@/components/dashboard-shell"

export default function ProfilePage() {
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
                <AvatarImage src={''} />
                <AvatarFallback className="text-lg">
                  {'U'}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-xl font-semibold">{'User'}</h3>
                <p className="text-muted-foreground"></p>
                <Badge variant="secondary" className="mt-2">
                  {'Regular User'}
                </Badge>
              </div>
            </div>

            <div className="grid gap-4">
              <div>
                <label className="text-sm font-medium">Email</label>
                <p className="text-sm text-muted-foreground"></p>
              </div>
              <div>
                <label className="text-sm font-medium">Role</label>
                <p className="text-sm text-muted-foreground">
                  {'Regular User'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">User ID</label>
                <p className="text-sm text-muted-foreground font-mono"></p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  )
}