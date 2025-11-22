"use client"

import { useEffect } from "react"
import { SessionProvider } from "next-auth/react"
import { SettingsProvider } from "@/lib/settings-context"
import { SocketProvider } from "@/lib/socket-context"
import { NotificationProvider } from "@/lib/notification-context"

function ServiceWorkerProvider() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered:', registration);
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    }
  }, []);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SettingsProvider>
        <NotificationProvider>
          <SocketProvider>
            {children}
          </SocketProvider>
        </NotificationProvider>
      </SettingsProvider>
    </SessionProvider>
  )
}